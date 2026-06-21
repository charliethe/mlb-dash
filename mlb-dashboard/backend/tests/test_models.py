from models import Team, Game, Pitcher


def test_team_defaults():
    t = Team(id="1", name="Test", abbreviation="TST", league="NL")
    assert t.wins == 0
    assert t.win_pct == 0.0
    assert t.pitcher is None


def test_team_with_pitcher():
    p = Pitcher(name="Ace", era=2.50, strikeouts=100)
    t = Team(id="1", name="Test", abbreviation="TST", league="NL", pitcher=p)
    assert t.pitcher.name == "Ace"
    assert t.pitcher.era == 2.50


def test_game_defaults():
    ht = Team(id="1", name="Home", abbreviation="HOM", league="NL")
    at = Team(id="2", name="Away", abbreviation="AWY", league="NL")
    g = Game(id="100", date="2026-06-03", home_team=ht, away_team=at)
    assert g.status == "scheduled"
    assert g.odds_source == "calculated"
    assert g.home_score is None
    assert g.over_under is None


def test_game_with_scores():
    ht = Team(id="1", name="Home", abbreviation="HOM", league="NL")
    at = Team(id="2", name="Away", abbreviation="AWY", league="NL")
    g = Game(id="100", date="2026-06-03", home_team=ht, away_team=at,
             home_score=5, away_score=3, status="Final")
    assert g.home_score == 5
    assert g.away_score == 3
    assert g.status == "Final"


def test_bet_recommendation_defaults():
    from models import BetRecommendation
    br = BetRecommendation(
        game_id="1", matchup="A @ B", bet_type="moneyline",
        side="home", confidence=0.7, edge=3.0, reasoning=["test"],
    )
    assert br.status == "pending"
    assert br.units is None
    assert br.odds is None
