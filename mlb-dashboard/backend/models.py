from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Pitcher(BaseModel):
    name: str
    wins: int = 0
    losses: int = 0
    era: float = 0.0
    strikeouts: int = 0


class Team(BaseModel):
    id: str
    name: str
    abbreviation: str
    league: str
    wins: int = 0
    losses: int = 0
    win_pct: float = 0.0
    runs_scored: int = 0
    runs_allowed: int = 0
    last_ten: str = ""
    pitcher: Optional[Pitcher] = None


class VenueInfo(BaseModel):
    name: str
    park_factor: float
    label: str  # "Hitter-friendly", "Pitcher-friendly", "Neutral"
    description: str  # e.g. "Launching pad — 18% more runs than average"
    home_run_factor: str = "Average"
    overs_rate: str = ""  # "54% overs historically"


class Game(BaseModel):
    id: str
    date: str
    home_team: Team
    away_team: Team
    home_moneyline: Optional[int] = None
    away_moneyline: Optional[int] = None
    over_under: Optional[float] = None
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    status: str = "scheduled"
    venue: str = ""
    venue_info: Optional[VenueInfo] = None
    home_pitcher: Optional[Pitcher] = None
    away_pitcher: Optional[Pitcher] = None
    home_implied_prob: Optional[float] = None
    away_implied_prob: Optional[float] = None
    odds_source: str = "calculated"
    inning_state: Optional[str] = None
    game_date: Optional[str] = None
    ou_over_odds: Optional[int] = None
    ou_under_odds: Optional[int] = None


class BetRecommendation(BaseModel):
    game_id: str
    matchup: str
    bet_type: str
    side: str
    odds: Optional[int] = None
    line: Optional[float] = None
    confidence: float
    edge: float
    reasoning: list[str]
    status: str = "pending"
    units: Optional[float] = None
    kelly_fraction: Optional[float] = None


class AnalysisResult(BaseModel):
    model_config = {'protected_namespaces': ()}
    game: Game
    recommendations: list[BetRecommendation]
    home_win_prob: float
    away_win_prob: float
    projected_total: float
    over_prob: float
    under_prob: float
    model_version: str = "1.0.0"
