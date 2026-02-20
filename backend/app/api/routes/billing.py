"""
Previa App — Stripe Billing Routes
Subscription management: checkout sessions, webhooks, and customer portal.
"""

import logging
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config.settings import settings
from app.data.db.models import User
from app.data.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["billing"])

stripe.api_key = settings.stripe_secret_key

PLAN_TO_PRICE_ID = {
    "basic": settings.stripe_basic_price_id,
    "premium": settings.stripe_premium_price_id,
    "company": settings.stripe_company_price_id,
}


def _stripe_configured() -> bool:
    return bool(settings.stripe_secret_key)


# ── Schemas ───────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: str  # basic, premium, company
    success_url: str = "https://previa.app/tablero?billing=success"
    cancel_url: str = "https://previa.app/tablero?billing=cancel"


class PortalRequest(BaseModel):
    return_url: str = "https://previa.app/tablero"


class PlanStatusResponse(BaseModel):
    plan: str
    stripe_customer_id: str | None
    stripe_subscription_id: str | None
    plan_expires_at: str | None


# ── Checkout (create Stripe session) ──────────────────────────────────────────

@router.post("/billing/checkout")
async def create_checkout_session(
    body: CheckoutRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    if not _stripe_configured():
        raise HTTPException(503, "Stripe billing is not configured")

    price_id = PLAN_TO_PRICE_ID.get(body.plan)
    if not price_id:
        raise HTTPException(400, f"Invalid plan: {body.plan}")

    user = (await db.execute(
        select(User).where(User.id == current_user["user_id"])
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    customer_id = user.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name or user.email,
            metadata={"user_id": str(user.id)},
        )
        user.stripe_customer_id = customer.id
        await db.commit()
        customer_id = customer.id

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"user_id": str(user.id), "plan": body.plan},
    )

    return {"checkout_url": session.url, "session_id": session.id}


# ── Customer portal ───────────────────────────────────────────────────────────

@router.post("/billing/portal")
async def create_portal_session(
    body: PortalRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    if not _stripe_configured():
        raise HTTPException(503, "Stripe billing is not configured")

    user = (await db.execute(
        select(User).where(User.id == current_user["user_id"])
    )).scalar_one_or_none()
    if not user or not user.stripe_customer_id:
        raise HTTPException(400, "No active subscription found")

    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=body.return_url,
    )
    return {"portal_url": session.url}


# ── Plan status ───────────────────────────────────────────────────────────────

@router.get("/billing/status", response_model=PlanStatusResponse)
async def get_plan_status(
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(
        select(User).where(User.id == current_user["user_id"])
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    return PlanStatusResponse(
        plan=user.plan or "free",
        stripe_customer_id=user.stripe_customer_id,
        stripe_subscription_id=user.stripe_subscription_id,
        plan_expires_at=user.plan_expires_at.isoformat() if user.plan_expires_at else None,
    )


# ── Webhook (Stripe events) ──────────────────────────────────────────────────

@router.post("/billing/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if not _stripe_configured():
        raise HTTPException(503, "Stripe billing is not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret,
        )
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(400, "Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(db, data)
    elif event_type == "customer.subscription.updated":
        await _handle_subscription_updated(db, data)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(db, data)
    else:
        logger.debug("Unhandled Stripe event: %s", event_type)

    return {"status": "ok"}


async def _handle_checkout_completed(db: AsyncSession, session: dict):
    user_id = session.get("metadata", {}).get("user_id")
    plan = session.get("metadata", {}).get("plan", "basic")
    subscription_id = session.get("subscription")

    if not user_id:
        logger.warning("Checkout completed but no user_id in metadata")
        return

    user = (await db.execute(
        select(User).where(User.id == int(user_id))
    )).scalar_one_or_none()
    if not user:
        return

    user.plan = plan
    user.stripe_subscription_id = subscription_id
    await db.commit()
    logger.info("User %s upgraded to plan=%s via checkout", user_id, plan)


async def _handle_subscription_updated(db: AsyncSession, subscription: dict):
    customer_id = subscription.get("customer")
    if not customer_id:
        return

    user = (await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )).scalar_one_or_none()
    if not user:
        return

    status = subscription.get("status")
    if status in ("active", "trialing"):
        from datetime import datetime
        period_end = subscription.get("current_period_end")
        if period_end:
            user.plan_expires_at = datetime.utcfromtimestamp(period_end)
    elif status in ("past_due", "unpaid"):
        logger.warning("Subscription %s is %s for user %s", subscription["id"], status, user.id)

    await db.commit()


async def _handle_subscription_deleted(db: AsyncSession, subscription: dict):
    customer_id = subscription.get("customer")
    if not customer_id:
        return

    user = (await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )).scalar_one_or_none()
    if not user:
        return

    user.plan = "free"
    user.stripe_subscription_id = None
    user.plan_expires_at = None
    await db.commit()
    logger.info("User %s downgraded to free (subscription cancelled)", user.id)
