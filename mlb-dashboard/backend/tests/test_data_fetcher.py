import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from data_fetcher import _implied_prob, _team_quality, _calc_odds, _cache_stale


def test_implied_prob_positive():
    assert abs(_implied_prob(200) - 0.333) < 0.01


def test_implied_prob_negative():
    assert abs(_implied_prob(-150) - 0.6) < 0.01


def test_team_quality_empty():
    assert abs(_team_quality({}) - 50.0) < 0.1


def test_team_quality_good():
    stats = {"win_pct": 0.700, "runs_scored": 400, "runs_allowed": 300, "games_played": 80}
    q = _team_quality(stats)
    assert q > 50


def test_team_quality_bad():
    stats = {"win_pct": 0.300, "runs_scored": 300, "runs_allowed": 400, "games_played": 80}
    q = _team_quality(stats)
    assert q < 50


def test_calc_odds_favorite_home():
    hq, aq = 80, 50
    ml_h, ml_a, ou = _calc_odds(hq, aq)
    assert ml_h < 0  # home favorite
    assert ml_a > 0  # away underdog
    assert 5.0 <= ou <= 14.0

def test_calc_odds_neutral():
    hq, aq = 50, 50
    ml_h, ml_a, ou = _calc_odds(hq, aq)
    assert ml_h == ml_a  # equal quality = same odds
    assert 5.0 <= ou <= 14.0


def test_calc_odds_underdog_home():
    hq, aq = 30, 70
    ml_h, ml_a, ou = _calc_odds(hq, aq)
    assert ml_h > 0  # home underdog
    assert ml_a < 0  # away favorite


def test_calc_odds_vig():
    # Implied probs should sum to > 1 (vig present)
    hq, aq = 60, 50
    ml_h, ml_a, _ = _calc_odds(hq, aq)
    prob_h = _implied_prob(ml_h)
    prob_a = _implied_prob(ml_a)
    total = prob_h + prob_a
    assert total > 1.0
    assert total < 1.10


def test_calc_odds_clamped():
    hq, aq = 200, 10
    ml_h, ml_a, _ = _calc_odds(hq, aq)
    assert -300 <= ml_h <= 300
    assert -300 <= ml_a <= 300


def test_cache_stale():
    import time
    assert _cache_stale(time.time() - 1000, 100) is True
    assert _cache_stale(time.time(), 1000) is False
