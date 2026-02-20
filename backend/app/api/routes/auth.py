"""
Previa App — Authentication Routes
POST /api/auth/login     — Returns a JWT access token.
POST /api/auth/register  — Create a new account and return a JWT.
"""

import logging
import re
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import create_access_token, verify_password, hash_password
from app.data.db.models import User, Organization
from app.data.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])

_PASSWORD_MIN_LENGTH = 8


# ── Request / Response schemas ────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization_name: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < _PASSWORD_MIN_LENGTH:
            raise ValueError(f"La contraseña debe tener al menos {_PASSWORD_MIN_LENGTH} caracteres")
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("La contraseña debe contener letras y números")
        return v

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("El nombre es requerido")
        return v.strip()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
    role: str
    plan: str = "free"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
async def register(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Create a new user, auto-create a default Organization, and return a signed JWT.

    - Returns 409 if the email is already registered.
    - Password must be >= 8 chars with at least one letter and one digit.
    """
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este correo electrónico ya está registrado",
        )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role="analyst",
        plan="free",
    )
    db.add(user)
    await db.flush()

    org_name = body.organization_name or f"Org de {body.full_name}"
    org = Organization(user_id=user.id, name=org_name)
    db.add(org)

    await db.commit()
    await db.refresh(user)

    token = create_access_token(data={"sub": user.email, "role": user.role, "user_id": user.id})
    logger.info("New registration: email=%s, plan=free", user.email)

    return TokenResponse(
        access_token=token,
        email=user.email,
        role=user.role,
        plan=user.plan,
    )


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
    """
    result = await db.execute(select(User).where(User.email == body.email))
    user: User | None = result.scalar_one_or_none()

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

    token = create_access_token(data={"sub": user.email, "role": user.role, "user_id": user.id})
    logger.info("Successful login for email=%s", user.email)

    return TokenResponse(
        access_token=token,
        email=user.email,
        role=user.role,
        plan=getattr(user, "plan", "free"),
    )
