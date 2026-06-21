import os
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

API_KEY = os.environ.get("API_KEY", "")


class APIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not API_KEY:
            return await call_next(request)
        if request.url.path in ("/docs", "/openapi.json", "/api/health"):
            return await call_next(request)
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {API_KEY}":
            raise HTTPException(status_code=401, detail="Invalid API key")
        return await call_next(request)
