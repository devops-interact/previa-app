"""
Previa App — Authentication Routes
POST /api/auth/login  — Returns a JWT access token.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import create_access_token, verify_password
from app.data.db.models import User
from app.data.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])


# ── Request / Response schemas ────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
    role: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/auth/login",
    response_model=TokenResponse,
    summary="Authenticate and receive a JWT access token",
)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Validate email/password against the User table and return a signed JWT.

    - Returns 401 if the user is not found or the password is wrong.
    - Returns 403 if the account is inactive.
    - Token lifetime is controlled by `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`.
    """
    # Fetch user by email
    result = await db.execute(select(User).where(User.email == body.email))
    user: User | None = result.scalar_one_or_none()

    # Constant-time failure — never reveal which field is wrong
    if user is None or not verify_password(body.password, user.hashed_password):
        logger.warning("Failed login attempt for email=%s", body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    token = create_access_token(data={"sub": user.email, "role": user.role})
    logger.info("Successful login for email=%s", user.email)

    return TokenResponse(
        access_token=token,
        email=user.email,
        role=user.role,
    )
