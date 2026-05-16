"""Auth routes: register and login."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from api.auth import create_token, hash_password, verify_password
from db.models import User, async_session

auth_router = APIRouter(prefix="/auth")


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@auth_router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest):
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    async with async_session() as session:
        existing = (await session.execute(
            select(User).where(User.email == req.email)
        )).scalar_one_or_none()

        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        user = User(email=req.email, hashed_password=hash_password(req.password))
        session.add(user)
        await session.commit()
        await session.refresh(user)

    return {"token": create_token(user.id), "user": user.to_dict()}


@auth_router.post("/login")
async def login(req: LoginRequest):
    async with async_session() as session:
        user = (await session.execute(
            select(User).where(User.email == req.email)
        )).scalar_one_or_none()

    if user is None or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {"token": create_token(user.id), "user": user.to_dict()}
