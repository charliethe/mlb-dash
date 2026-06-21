import pytest
import sys
import os
import json
import tempfile
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from bet_tracker import BetTracker, TrackedPick
from models import BetRecommendation


@pytest.fixture(autouse=True)
def isolate_tracker_file():
    """Redirect bet_history.json to a temp file for each test."""
    orig = os.path.join(os.path.dirname(__file__), "..", "bet_history.json")
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    json.dump([], tmp)
    tmp.close()
    import bet_tracker as bt
    bt.TRACKER_FILE = tmp.name
    yield
    os.unlink(tmp.name)


@pytest.fixture
def sample_game_dict():
    return {
        "id": "12345",
        "date": datetime.now().strftime("%Y-%m-%d"),
        "home_team": {
            "id": "119",
            "name": "Los Angeles Dodgers",
            "abbreviation": "LAD",
            "league": "NL",
            "wins": 35,
            "losses": 20,
            "win_pct": 0.636,
            "runs_scored": 280,
            "runs_allowed": 210,
            "last_ten": "7-3",
        },
        "away_team": {
            "id": "121",
            "name": "New York Mets",
            "abbreviation": "NYM",
            "league": "NL",
            "wins": 30,
            "losses": 25,
            "win_pct": 0.545,
            "runs_scored": 250,
            "runs_allowed": 240,
            "last_ten": "5-5",
        },
        "home_moneyline": -150,
        "away_moneyline": +130,
        "over_under": 8.5,
        "home_score": None,
        "away_score": None,
        "status": "Scheduled",
        "venue": "Dodger Stadium",
        "home_pitcher": {"name": "Yoshinobu Yamamoto", "wins": 5, "losses": 2, "era": 2.80, "strikeouts": 65},
        "away_pitcher": {"name": "Kodai Senga", "wins": 3, "losses": 3, "era": 3.50, "strikeouts": 55},
        "home_implied_prob": 0.60,
        "away_implied_prob": 0.40,
        "odds_source": "real",
    }


@pytest.fixture
def sample_pick():
    return BetRecommendation(
        game_id="12345",
        matchup="New York Mets @ Los Angeles Dodgers",
        bet_type="moneyline",
        side="home",
        odds=-150,
        confidence=0.75,
        edge=5.2,
        reasoning=["Strong pitching advantage"],
    )


@pytest.fixture
def empty_tracker():
    return BetTracker()


@pytest.fixture
def tracker_with_picks(empty_tracker, sample_pick):
    empty_tracker.track(sample_pick, datetime.now().strftime("%Y-%m-%d"))
    return empty_tracker
