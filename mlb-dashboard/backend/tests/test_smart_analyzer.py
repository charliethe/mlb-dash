from smart_analyzer import _pythagorean_win_pct, _run_diff_strength, _pitcher_rating, _weighted_form, _implied_prob_to_decimal, _decimal_to_american
from models import Team, Pitcher


def test_pythagorean_win_pct():
    t = Team(id="1", name="T", abbreviation="T", league="NL", runs_scored=100, runs_allowed=80)
    pct = _pythagorean_win_pct(t)
    expected = (100 ** 2) / (100 ** 2 + 80 ** 2)
    assert abs(pct - expected) < 0.001


def test_pythagorean_zero_runs_allowed():
    t = Team(id="1", name="T", abbreviation="T", league="NL", runs_scored=50, runs_allowed=0)
    pct = _pythagorean_win_pct(t)
    assert abs(pct - 1.0) < 0.001


def test_run_diff_strength():
    t = Team(id="1", name="T", abbreviation="T", league="NL", runs_scored=200, runs_allowed=150)
    r = _run_diff_strength(t)
    expected = max(-0.5, min(0.5, 50 / 162.0))
    assert abs(r - expected) < 0.001


def test_pitcher_rating_none():
    assert abs(_pitcher_rating(None) - 0.5) < 0.001


def test_pitcher_rating_good():
    p = Pitcher(name="Ace", era=2.50, strikeouts=100)
    r = _pitcher_rating(p)
    assert 0.5 <= r <= 1.0


def test_pitcher_rating_bad():
    p = Pitcher(name="Bad", era=8.00, strikeouts=20)
    r = _pitcher_rating(p)
    assert 0.0 <= r <= 0.6


def test_weighted_form():
    form = _weighted_form("7-3", 0.600)
    expected = 0.6 * 0.7 + 0.4 * 0.6
    assert abs(form - expected) < 0.001


def test_weighted_form_few_games():
    form = _weighted_form("2-1", 0.600)
    expected = 0.6 * (2/3) + 0.4 * 0.6
    assert abs(form - expected) < 0.001


def test_weighted_form_empty():
    assert _weighted_form("0-0", 0.500) == 0.500


def test_implied_prob_to_decimal_positive():
    p = _implied_prob_to_decimal(+200)
    assert abs(p - 100/300) < 0.001


def test_implied_prob_to_decimal_negative():
    p = _implied_prob_to_decimal(-150)
    assert abs(p - 150/250) < 0.001


def test_implied_prob_to_decimal_none():
    assert abs(_implied_prob_to_decimal(None) - 0.5) < 0.001


def test_decimal_to_american_favorite():
    ml = _decimal_to_american(0.6)
    assert ml == -150


def test_decimal_to_american_underdog():
    ml = _decimal_to_american(0.4)
    assert ml == +150


def test_decimal_to_american_extreme():
    ml = _decimal_to_american(0.01)
    assert ml == +9900
    ml = _decimal_to_american(0.99)
    assert ml == -9900
