import json
from datetime import datetime
from bet_tracker import BetTracker, TrackedPick, _calculate_units
from models import BetRecommendation


def test_calculate_units_positive():
    assert abs(_calculate_units(+200) - 2.0) < 0.001


def test_calculate_units_negative():
    assert abs(_calculate_units(-150) - 0.667) < 0.01


def test_calculate_units_none():
    assert abs(_calculate_units(None) - 1.0) < 0.001


def test_track_adds_pick(tracker_with_picks):
    assert len(tracker_with_picks.picks) == 1


def test_track_does_not_duplicate(tracker_with_picks, sample_pick):
    tracker_with_picks.track(sample_pick, datetime.now().strftime("%Y-%m-%d"))
    assert len(tracker_with_picks.picks) == 1


def test_resolve_moneyline_win(sample_pick):
    t = BetTracker()
    t.track(sample_pick, datetime.now().strftime("%Y-%m-%d"))
    game = {
        "id": "12345", "status": "Final",
        "home_score": 5, "away_score": 3,
    }
    t.resolve_games([game])
    tp = list(t.picks.values())[0]
    assert tp.status == "won"
    assert tp.units > 0


def test_resolve_moneyline_loss(sample_pick):
    pick2 = BetRecommendation(
        game_id="12345", matchup="NYM @ LAD", bet_type="moneyline",
        side="away", odds=+130, confidence=0.6, edge=2.0, reasoning=[],
    )
    t = BetTracker()
    t.track(pick2, datetime.now().strftime("%Y-%m-%d"))
    game = {
        "id": "12345", "status": "Final",
        "home_score": 5, "away_score": 3,
    }
    t.resolve_games([game])
    tp = list(t.picks.values())[0]
    assert tp.status == "lost"
    assert tp.units == -1.0


def test_resolve_over_win():
    pick = BetRecommendation(
        game_id="1", matchup="A @ B", bet_type="over_under",
        side="over", line=8.5, confidence=0.6, edge=2.0, reasoning=[],
    )
    t = BetTracker()
    t.track(pick, datetime.now().strftime("%Y-%m-%d"))
    game = {"id": "1", "status": "Final", "home_score": 6, "away_score": 5}
    t.resolve_games([game])
    tp = list(t.picks.values())[0]
    assert tp.status == "won"


def test_resolve_over_loss():
    pick = BetRecommendation(
        game_id="1", matchup="A @ B", bet_type="over_under",
        side="over", line=8.5, confidence=0.6, edge=2.0, reasoning=[],
    )
    t = BetTracker()
    t.track(pick, datetime.now().strftime("%Y-%m-%d"))
    game = {"id": "1", "status": "Final", "home_score": 4, "away_score": 3}
    t.resolve_games([game])
    tp = list(t.picks.values())[0]
    assert tp.status == "lost"


def test_resolve_over_push():
    pick = BetRecommendation(
        game_id="1", matchup="A @ B", bet_type="over_under",
        side="over", line=8.0, confidence=0.6, edge=2.0, reasoning=[],
    )
    t = BetTracker()
    t.track(pick, datetime.now().strftime("%Y-%m-%d"))
    game = {"id": "1", "status": "Final", "home_score": 5, "away_score": 3}
    t.resolve_games([game])
    tp = list(t.picks.values())[0]
    assert tp.status == "push"
    assert tp.units == 0.0


def test_resolve_under_push():
    pick = BetRecommendation(
        game_id="1", matchup="A @ B", bet_type="over_under",
        side="under", line=8.0, confidence=0.6, edge=2.0, reasoning=[],
    )
    t = BetTracker()
    t.track(pick, datetime.now().strftime("%Y-%m-%d"))
    game = {"id": "1", "status": "Final", "home_score": 5, "away_score": 3}
    t.resolve_games([game])
    tp = list(t.picks.values())[0]
    assert tp.status == "push"
    assert tp.units == 0.0


def test_skips_non_final(tracker_with_picks):
    game = {"id": "12345", "status": "Scheduled", "home_score": 5, "away_score": 3}
    tracker_with_picks.resolve_games([game])
    tp = list(tracker_with_picks.picks.values())[0]
    assert tp.status == "pending"


def test_stats(tracker_with_picks):
    t = tracker_with_picks
    game = {"id": "12345", "status": "Final", "home_score": 5, "away_score": 3}
    t.resolve_games([game])
    stats = t.get_stats()
    assert stats["won"] == 1
    assert stats["total"] == 1
    assert stats["win_rate"] == 1.0
    assert stats["total_units"] > 0
    assert stats["starting_bankroll"] == 100.0
    assert stats["roi"] > 0


def test_persistence(sample_pick):
    t = BetTracker()
    t.picks.clear()
    t.track(sample_pick, datetime.now().strftime("%Y-%m-%d"))
    assert len(t.picks) == 1
    t._save()
    t2 = BetTracker()
    key = f"{sample_pick.game_id}_{sample_pick.bet_type}_{sample_pick.side}"
    assert key in t2.picks
