import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routers import analytics, company, generate, posts, settings, social, telegram
from app.tasks.telegram_poller import run_telegram_poller


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task = asyncio.create_task(run_telegram_poller())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="AI Social Autopilot", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings.router,  prefix="/api/settings",       tags=["settings"])
app.include_router(company.router,   prefix="/api/company",         tags=["company"])
app.include_router(posts.router,     prefix="/api/posts",           tags=["posts"])
app.include_router(generate.router,  prefix="/api/generate",        tags=["generate"])
app.include_router(social.router,    prefix="/api/social-accounts", tags=["social"])
app.include_router(telegram.router,  prefix="/api/telegram",        tags=["telegram"])
app.include_router(analytics.router, prefix="/api/analytics",       tags=["analytics"])

DIST = Path(__file__).parent / "frontend" / "dist"

if DIST.exists():
    app.mount("/", StaticFiles(directory=str(DIST), html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {"status": "backend running", "note": "Build the frontend: cd frontend && npm install && npm run build"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
