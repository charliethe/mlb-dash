import math
from typing import Optional
from models import Game, BetRecommendation, AnalysisResult, Team, Pitcher, VenueInfo


def _kelly_fraction(odds: Optional[int], win_prob: float, fractional: float = 0.25) -> float:
    if odds is None or win_prob <= 0 or win_prob >= 1:
        return 0.0
    if odds > 0:
        b = odds / 100.0
    else:
        b = 100.0 / abs(odds)
    q = 1.0 - win_prob
    f = (b * win_prob - q) / b
    f = max(0.0, min(f, 0.25))
    return round(f * fractional, 4)


def _implied_prob_to_decimal(odds: Optional[int]) -> float:
    if odds is None:
        return 0.5
    if odds > 0:
        return 100 / (odds + 100)
    return abs(odds) / (abs(odds) + 100)


def _decimal_to_american(prob: float) -> int:
    prob = max(0.01, min(0.99, prob))
    if prob > 0.5:
        return round(-100 * prob / (1 - prob))
    return round((100 / prob) - 100)


def _park_factor(venue: str) -> float:
    park_factors = {
        "Coors Field": 1.18, "Great American Ball Park": 1.08, "Fenway Park": 1.06,
        "Yankee Stadium": 1.05, "Citizens Bank Park": 1.07, "American Family Field": 1.04,
        "Globe Life Field": 1.02, "Chase Field": 1.06, "Truist Park": 1.03,
        "Minute Maid Park": 1.01, "Wrigley Field": 0.98, "Citi Field": 0.96,
        "Oracle Park": 0.95, "Petco Park": 0.94, "T-Mobile Park": 0.93,
        "Oakland Coliseum": 0.94, "Comerica Park": 0.97, "Target Field": 0.99,
        "Rogers Centre": 1.03, "Angel Stadium": 1.00,
    }
    return park_factors.get(venue, 1.00)

def get_venue_info(venue: str) -> VenueInfo:
    park_data = {
        "Coors Field": (1.18, "Hitter-friendly", "Launching pad — 18% more runs than average", "Very High", "56%"),
        "Great American Ball Park": (1.08, "Hitter-friendly", "8% more runs — plays small", "High", "53%"),
        "Fenway Park": (1.06, "Hitter-friendly", "The Monster creates runs — 6% above average", "High", "53%"),
        "Yankee Stadium": (1.05, "Hitter-friendly", "Short porch in right — 5% more runs", "High", "52%"),
        "Citizens Bank Park": (1.07, "Hitter-friendly", "Philly plays big — 7% more runs", "High", "54%"),
        "American Family Field": (1.04, "Hitter-friendly", "4% above average with the roof closed", "Above Avg", "52%"),
        "Globe Life Field": (1.02, "Slight hitter", "2% above average — neutral-ish", "Average", "50%"),
        "Chase Field": (1.06, "Hitter-friendly", "6% more runs with the roof open", "High", "53%"),
        "Truist Park": (1.03, "Slight hitter", "3% above average", "Above Avg", "51%"),
        "Minute Maid Park": (1.01, "Neutral", "Essentially neutral — 1% above", "Average", "50%"),
        "Wrigley Field": (0.98, "Slight pitcher", "2% below average — wind helps pitchers", "Below Avg", "48%"),
        "Citi Field": (0.96, "Pitcher-friendly", "4% fewer runs — pitcher's haven", "Low", "46%"),
        "Oracle Park": (0.95, "Pitcher-friendly", "Tricky winds keep scoring down — 5% below", "Low", "46%"),
        "Petco Park": (0.94, "Pitcher-friendly", "6% fewer runs — death to fly balls", "Low", "45%"),
        "T-Mobile Park": (0.93, "Pitcher-friendly", "7% below average — marine layer effect", "Very Low", "45%"),
        "Oakland Coliseum": (0.94, "Pitcher-friendly", "6% below — cavernous foul territory", "Low", "46%"),
        "Comerica Park": (0.97, "Slight pitcher", "3% below average — big gaps", "Below Avg", "47%"),
        "Target Field": (0.99, "Neutral", "Essentially neutral — 1% below", "Average", "49%"),
        "Rogers Centre": (1.03, "Slight hitter", "3% above average with roof closed", "Above Avg", "51%"),
        "Angel Stadium": (1.00, "Neutral", "Dead neutral — exactly league average", "Average", "50%"),
    }
    data = park_data.get(venue)
    if data:
        pf, label, desc, hr, overs = data
    else:
        pf, label, desc, hr, overs = 1.00, "Unknown", "No ballpark data available", "N/A", "N/A"
    return VenueInfo(name=venue, park_factor=pf, label=label, description=desc, home_run_factor=hr, overs_rate=overs)


def _run_diff_strength(team: Team) -> float:
    rd = team.runs_scored - team.runs_allowed
    return max(-0.5, min(0.5, rd / 162.0))


def _pythagorean_win_pct(team: Team) -> float:
    rs = team.runs_scored if team.runs_scored > 0 else 1
    ra = team.runs_allowed if team.runs_allowed > 0 else 1
    return (rs ** 2) / (rs ** 2 + ra ** 2)


def _weighted_form(last_ten: str, win_pct: float) -> float:
    try:
        w, l = last_ten.split("-")
        recent_w = int(w)
        recent_l = int(l)
        total = recent_w + recent_l
        if total == 0:
            return win_pct
        recent_pct = recent_w / total
        return 0.6 * recent_pct + 0.4 * win_pct
    except (ValueError, AttributeError):
        return win_pct


def _pitcher_rating(pitcher: Optional[Pitcher]) -> float:
    if pitcher is None:
        return 0.5
    era = pitcher.era if pitcher.era > 0 else 5.0
    k_rate = pitcher.strikeouts / 200.0 if pitcher.strikeouts else 0.5
    era_score = max(0, 1.0 - (era - 2.5) / 5.0)
    return min(1.0, era_score * 0.7 + k_rate * 0.3)


def _confidence_based_on_agreement(factors: list[float]) -> float:
    if not factors:
        return 0.5
    mean = sum(factors) / len(factors)
    variance = sum((f - mean) ** 2 for f in factors) / len(factors)
    agreement = 1.0 - math.sqrt(variance)
    return 0.5 + (agreement * 0.4)


def analyze_game(game: Game) -> AnalysisResult:
    ht = game.home_team
    at = game.away_team

    home_pyth = _pythagorean_win_pct(ht)
    away_pyth = _pythagorean_win_pct(at)

    home_form = _weighted_form(ht.last_ten, ht.win_pct)
    away_form = _weighted_form(at.last_ten, at.win_pct)

    home_pitcher_rating = _pitcher_rating(game.home_pitcher)
    away_pitcher_rating = _pitcher_rating(game.away_pitcher)

    home_rd = _run_diff_strength(ht)
    away_rd = _run_diff_strength(at)

    home_advantage = 0.04

    home_score = (home_pyth * 0.25 + home_form * 0.25 +
                  home_pitcher_rating * 0.25 + home_rd * 0.15 + home_advantage * 0.10)
    away_score = (away_pyth * 0.25 + away_form * 0.25 +
                  away_pitcher_rating * 0.25 + away_rd * 0.25)

    eps = 1e-6
    home_win_prob = (home_score + eps) / (home_score + away_score + 2 * eps)
    home_win_prob = max(0.25, min(0.75, home_win_prob))
    away_win_prob = 1.0 - home_win_prob

    projected_home_runs = 3.5 + (home_rd * 2) + (home_pitcher_rating * 1.5) + home_advantage * 4
    projected_away_runs = 3.5 + (away_rd * 2) + (away_pitcher_rating * 1.5)
    pf = _park_factor(game.venue)

    projected_total = (projected_home_runs + projected_away_runs) * pf
    projected_total = max(5.0, min(13.0, projected_total))

    over_prob = projected_total / (projected_total + game.over_under) if game.over_under else 0.5
    over_prob = max(0.1, min(0.9, over_prob))
    under_prob = 1.0 - over_prob

    recommendations = []

    fair_home_prob = home_win_prob
    market_home_prob = game.home_implied_prob or 0.5
    # When odds are model-calculated (not from sportsbook), implied prob equals our own — no edge to find
    if game.odds_source == "calculated":
        market_home_prob = fair_home_prob
    home_edge = fair_home_prob - market_home_prob

    if abs(home_edge) > 0.01:
        side = "home" if home_edge > 0 else "away"
        edge_val = min(abs(home_edge), 0.20)
        confidence = 0.5 + edge_val * 1.5
        confidence = min(0.80, max(0.1, confidence))
        fair_odds = _decimal_to_american(fair_home_prob if side == "home" else 1 - fair_home_prob)
        ml = game.home_moneyline if side == "home" else game.away_moneyline

        reasons = []
        if home_pitcher_rating > 0.7:
            reasons.append(f"Pitching advantage: {game.home_pitcher.name}" if side == "home"
                           else f"Pitching edge for {game.away_pitcher.name}")
        if abs(home_form - away_form) > 0.1:
            stronger = "home" if home_form > away_form else "away"
            rec = ht if stronger == "home" else at
            reasons.append(f"Recent form: {rec.last_ten} in last 10 ({rec.wins}-{rec.losses} overall)")
        if abs(home_rd - away_rd) > 0.15:
            team = ht if home_rd > away_rd else at
            rd_val = team.runs_scored - team.runs_allowed
            reasons.append(f"Run diff: {team.abbreviation} at {rd_val:+d} ({team.runs_scored} RS, {team.runs_allowed} RA)")
        if game.venue_info and game.venue_info.park_factor != 1.0:
            reasons.append(f"Venue: {game.venue_info.description}")

        win_prob = home_win_prob if side == "home" else away_win_prob
        kelly = _kelly_fraction(ml, win_prob)

        recommendations.append(BetRecommendation(
            game_id=game.id,
            matchup=f"{at.name} @ {ht.name}",
            bet_type="moneyline",
            side=side,
            odds=ml,
            confidence=round(confidence, 2),
            edge=round(edge_val * 100, 1),
            reasoning=reasons if reasons else ["Model projects value based on team strength"],
            kelly_fraction=kelly,
        ))

    fair_over_prob = over_prob
    market_over_prob = 0.5
    if game.odds_source == "calculated":
        market_over_prob = fair_over_prob
    over_edge = fair_over_prob - market_over_prob

    if abs(over_edge) > 0.01:
        side = "over" if over_edge > 0 else "under"
        edge_val = min(abs(over_edge), 0.20)
        confidence = 0.5 + edge_val * 1.5
        confidence = min(0.80, max(0.1, confidence))

        reasons = []
        if pf > 1.03:
            reasons.append(f"Ballpark factor ({pf:.2f}) favors scoring")
        elif pf < 0.97:
            reasons.append(f"Ballpark factor ({pf:.2f}) suppresses scoring")
        if abs(projected_total - game.over_under) > 0.5:
            reasons.append(f"Model projects {projected_total:.1f} runs vs market {game.over_under}")

        win_prob = over_prob if side == "over" else under_prob
        ou_odds = game.ou_over_odds if side == "over" else game.ou_under_odds
        kelly = _kelly_fraction(ou_odds, win_prob)

        recommendations.append(BetRecommendation(
            game_id=game.id,
            matchup=f"{at.name} @ {ht.name}",
            bet_type="over_under",
            side=side,
            line=game.over_under,
            confidence=round(confidence, 2),
            edge=round(edge_val * 100, 1),
            reasoning=reasons if reasons else ["Model projects total runs value"],
            kelly_fraction=kelly,
        ))

    return AnalysisResult(
        game=game,
        recommendations=recommendations,
        home_win_prob=round(home_win_prob, 3),
        away_win_prob=round(away_win_prob, 3),
        projected_total=round(projected_total, 2),
        over_prob=round(over_prob, 3),
        under_prob=round(under_prob, 3),
    )
