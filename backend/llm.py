"""
Inference client for Compilot.

Backend: Vultr Serverless Inference (OpenAI-compatible API).
Model: set via INFERENCE_MODEL env var (default: DeepSeek-V3.2-NVFP4).
Auth: INFERENCE_API_KEY env var (from Vultr Serverless Inference dashboard).
Base URL: INFERENCE_BASE_URL env var (from Vultr Serverless Inference dashboard).
"""

import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    base_url=os.getenv("INFERENCE_BASE_URL"),
    api_key=os.getenv("INFERENCE_API_KEY"),
)
