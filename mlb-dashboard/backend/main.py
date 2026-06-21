from fastapi import FastAPI, Query, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import os
import time
import logging

from data_fetcher import get_todays_games
from smart_analyzer import analyze_game
from models import Game, AnalysisResult
from bet_tracker import tracker
from sport_config import SPORTS
from rate_limit import RateLimitMiddleware

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

ANALYSIS_CACHE: dict[str, tuple[float, list[AnalysisResult]]] = {}
ANALYSIS_CACHE_TTL = 120


class VoidRequest(BaseModel):
    game_id: str
    bet_type: str
    side: str


app = FastAPI(title="MLB Betting Dashboard API", version="1.0.0")


@app.on_event("startup")
async def startup():
    odds_key = os.environ.get("ODDS_API_KEY", "")
    api_key = os.environ.get("API_KEY", "")
    logger.info("Starting server — ODDS_API_KEY=%s, API_KEY=%s", "set" if odds_key else "NOT SET", "set" if api_key else "NOT SET")


@app.on_event("shutdown")
async def shutdown():
    tracker._save()
    logger.info("Saved bet history on shutdown")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware, max_requests=60, window=60)

security = HTTPBearer(auto_error=False)
API_KEY = os.environ.get("API_KEY", "")


def verify_auth(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not API_KEY:
        return
    if not credentials or credentials.credentials != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _run_analysis(sport: str = "mlb"):
    global ANALYSIS_CACHE
    now = time.time()
    cached = ANALYSIS_CACHE.get(sport)
    if cached and (now - cached[0]) < ANALYSIS_CACHE_TTL:
        results = cached[1]
        tracker_picks = {f"{tp.game_id}_{tp.bet_type}_{tp.side}": tp for tp in tracker.picks.values()}
        for r in results:
            for pick in r.recommendations:
                key = f"{pick.game_id}_{pick.bet_type}_{pick.side}"
                tp = tracker_picks.get(key)
                if tp:
                    pick.status = tp.status
                    pick.units = tp.units
        return results
    games = get_todays_games(sport)
    results = []
    for g in games:
        result = analyze_game(g)
        results.append(result)
        today = g.date or ""
        for pick in result.recommendations:
            tracker.track(pick, today, sport)
    tracker.resolve_games([g.model_dump() for g in games])
    tracker_picks = {f"{tp.game_id}_{tp.bet_type}_{tp.side}": tp for tp in tracker.picks.values()}
    for r in results:
        for pick in r.recommendations:
            key = f"{pick.game_id}_{pick.bet_type}_{pick.side}"
            tp = tracker_picks.get(key)
            if tp:
                pick.status = tp.status
                pick.units = tp.units
    ANALYSIS_CACHE[sport] = (now, results)
    return results


@app.get("/api/sports")
def get_sports():
    return [{"key": k, "name": v["name"], "logo": v["logo"], "has_stats": v.get("has_stats", False)} for k, v in SPORTS.items()]


@app.get("/api/games", dependencies=[Depends(verify_auth)])
def get_games(sport: str = Query("mlb")) -> list[Game]:
    return get_todays_games(sport)


@app.get("/api/analysis/all", dependencies=[Depends(verify_auth)])
def get_all_analysis(sport: str = Query("mlb")) -> list[AnalysisResult]:
    return _run_analysis(sport)


@app.get("/api/analysis/picks", dependencies=[Depends(verify_auth)])
def get_picks(
    min_confidence: float = Query(0.5, ge=0, le=1),
    sort_by: str = Query("confidence", pattern="^(confidence|edge)$"),
    bet_type: Optional[str] = Query(None, pattern="^(moneyline|over_under)$"),
    limit: int = Query(20, ge=1, le=50),
    sport: str = Query("mlb"),
) -> dict:
    results = _run_analysis(sport)
    all_picks = []
    for r in results:
        all_picks.extend(r.recommendations)

    if bet_type:
        all_picks = [p for p in all_picks if p.bet_type == bet_type]

    all_picks = [p for p in all_picks if p.confidence >= min_confidence]

    if sort_by == "confidence":
        all_picks.sort(key=lambda x: x.confidence, reverse=True)
    else:
        all_picks.sort(key=lambda x: x.edge, reverse=True)

    return {"picks": all_picks[:limit], "total": len(all_picks)}


@app.get("/api/tracker/stats", dependencies=[Depends(verify_auth)])
def get_tracker_stats() -> dict:
    return tracker.get_stats()

@app.get("/api/tracker/history", dependencies=[Depends(verify_auth)])
def get_tracker_history() -> list[dict]:
    return tracker.get_history()

@app.get("/api/tracker/export", dependencies=[Depends(verify_auth)])
def export_tracker_csv():
    from fastapi.responses import PlainTextResponse
    csv = tracker.get_csv()
    return PlainTextResponse(csv, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=bet_history.csv"})

@app.get("/api/tracker/config", dependencies=[Depends(verify_auth)])
def get_tracker_config() -> dict:
    return tracker.config

@app.post("/api/tracker/config", dependencies=[Depends(verify_auth)])
def set_tracker_config(body: dict) -> dict:
    return tracker.save_config(body)


@app.post("/api/tracker/void", dependencies=[Depends(verify_auth)])
def void_pick(req: VoidRequest) -> dict:
    key = f"{req.game_id}_{req.bet_type}_{req.side}"
    if key in tracker.picks:
        del tracker.picks[key]
        tracker._save()
        return {"status": "voided", "key": key}
    return {"status": "not_found", "key": key}


@app.get("/api/health")
def health():
    odds_key_set = bool(os.environ.get("ODDS_API_KEY", ""))
    from data_fetcher import get_odds_usage
    return {
        "status": "ok",
        "model_version": "1.0.0",
        "odds_api_configured": odds_key_set,
        "tracked_picks": len(tracker.picks),
        "odds_api_usage": get_odds_usage(),
    }


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    backend_dir = os.path.dirname(__file__)
    for candidate in [os.path.join(backend_dir, "frontend"),
                      os.path.join(backend_dir, "..", "frontend")]:
        static_dir = candidate
        if not os.path.isdir(static_dir):
            continue
        file_path = os.path.join(static_dir, full_path) if full_path else os.path.join(static_dir, "index.html")
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
        index_path = os.path.join(static_dir, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        break
    return JSONResponse(status_code=404, content={"detail": "Not Found"})
