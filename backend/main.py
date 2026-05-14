"""
Compint FastAPI application entrypoint.

Run locally:
  uvicorn main:app --reload --port 8000

Celery worker (separate terminal):
  celery -A tasks.celery_app worker --loglevel=info
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from tasks import celery_app  # re-export so Celery CLI can find it

app = FastAPI(title="Compint API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
