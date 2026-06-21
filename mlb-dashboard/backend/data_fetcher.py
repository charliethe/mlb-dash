import os
import math
import json
import time
import logging
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from typing import Optional, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from models import Team, Game, Pitcher, VenueInfo
from smart_analyzer import get_venue_info
from sport_config import SPORTS

logger = logging.getLogger(__name__)

MLB_API = "https://statsapi.mlb.com/api/v1"
ODDS_API_KEY = os.environ.get("ODDS_API_KEY", "")

TEAM_ID_MAP: dict[int, dict[str, Any]] = {}
TEAM_ID_MAP_LOADED: float = 0.0
TEAM_ID_MAP_TTL = 3600

STANDINGS_CACHE: dict[int, dict[str, Any]] = {}
STANDINGS_CACHE_LOADED: float = 0.0
STANDINGS_CACHE_TTL = 600

ODDS_CACHE: list[dict] = []
ODDS_LAST_FETCHED: float = 0.0
ODDS_FETCH_INTERVAL = 600
ODDS_REQUEST_COUNT = {"month": datetime.now().month, "year": datetime.now().year, "count": 0}

SCHEDULE_CACHE: dict[str, Optional[Any]] = {}
SCHEDULE_CACHE_LOADED: dict[str, float] = {}
SCHEDULE_CACHE_TTL = 86400

PITCHER_CACHE: dict[int, Pitcher] = {}
PITCHER_CACHE_LOADED: dict[int, float] = {}
PITCHER_CACHE_TTL = 900

PITCHER_NAME_CACHE: dict[int, str] = {}


def _cache_stale(loaded_at: float, ttl: int) -> bool:
    return time.time() - loaded_at > ttl


def _load_pitcher_stats(person_id: int) -> Pitcher:
    cached = PITCHER_CACHE.get(person_id)
    cached_at = PITCHER_CACHE_LOADED.get(person_id, 0.0)
    if cached and not _cache_stale(cached_at, PITCHER_CACHE_TTL):
        return cached
    name = PITCHER_NAME_CACHE.get(person_id, "Unknown")
    url = f"{MLB_API}/people/{person_id}/stats?stats=season&season={datetime.now().year}&group=pitching"
    data = _fetch_json(url)
    if not data:
        p = Pitcher(name=name, wins=0, losses=0, era=0.0, strikeouts=0)
        PITCHER_CACHE[person_id] = p
        PITCHER_CACHE_LOADED[person_id] = time.time()
        return p
    for s in data.get("stats", []):
        for split in s.get("splits", []):
            stat = split.get("stat", {})
            p = Pitcher(
                name=name,
                wins=stat.get("wins", 0) or 0,
                losses=stat.get("losses", 0) or 0,
                era=float(stat.get("era", 0) or 0),
                strikeouts=stat.get("strikeOuts", 0) or 0,
            )
            PITCHER_CACHE[person_id] = p
            PITCHER_CACHE_LOADED[person_id] = time.time()
            return p
    p = Pitcher(name=name, wins=0, losses=0, era=0.0, strikeouts=0)
    PITCHER_CACHE[person_id] = p
    PITCHER_CACHE_LOADED[person_id] = time.time()
    return p


def _get_starting_pitchers(game_pk: int) -> tuple[Pitcher, Pitcher]:
    default = Pitcher(name="TBD", wins=0, losses=0, era=0.0, strikeouts=0)
    box = _fetch_json(f"{MLB_API}/game/{game_pk}/boxscore")
    if not box:
        return default, default

    linescore = _fetch_json(f"{MLB_API}/game/{game_pk}/linescore")

    def _get_pitcher(side: str) -> Pitcher:
        team = box.get("teams", {}).get(side, {})
        pitchers = team.get("pitchers", [])
        pid = pitchers[0] if pitchers else None
        if pid:
            pname = team.get("players", {}).get(f"ID{pid}", {}).get("person", {}).get("fullName", "Unknown")
            PITCHER_NAME_CACHE[pid] = pname
            return _load_pitcher_stats(pid)

        if linescore and side == "home":
            dp = linescore.get("defense", {}).get("pitcher", {})
            if dp and dp.get("id"):
                pid = dp["id"]
                PITCHER_NAME_CACHE[pid] = dp["fullName"]
                return _load_pitcher_stats(pid)

        return default

    return _get_pitcher("home"), _get_pitcher("away")


def _get_inning_state(game_pk: int) -> Optional[str]:
    ls = _fetch_json(f"{MLB_API}/game/{game_pk}/linescore")
    if not ls:
        return None
    inning = ls.get("currentInning")
    is_top = ls.get("isTopInning")
    if inning is None:
        return None
    half = "Top" if is_top else "Bot"
    outs = ls.get("outs", 0)
    return f"{half} {inning}, {outs} out(s)"


def _fetch_json(url: str, retries: int = 2) -> Optional[Any]:
    now = datetime.now()
    if "odds-api" in url:
        if ODDS_REQUEST_COUNT["month"] != now.month or ODDS_REQUEST_COUNT["year"] != now.year:
            ODDS_REQUEST_COUNT["month"] = now.month
            ODDS_REQUEST_COUNT["year"] = now.year
            ODDS_REQUEST_COUNT["count"] = 0
        ODDS_REQUEST_COUNT["count"] += 1
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MLB-Betting-Dashboard/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        except (urllib.error.URLError, json.JSONDecodeError, OSError) as e:
            if attempt < retries:
                time.sleep(1)
                continue
            logger.warning("API error for %s: %s", url, e)
            return None
    return None


def _load_all_teams() -> None:
    global TEAM_ID_MAP_LOADED
    if TEAM_ID_MAP and not _cache_stale(TEAM_ID_MAP_LOADED, TEAM_ID_MAP_TTL):
        return
    data = _fetch_json(f"{MLB_API}/teams?sportId=1")
    if not data:
        return
    TEAM_ID_MAP.clear()
    for t in data.get("teams", []):
        tid = t["id"]
        TEAM_ID_MAP[tid] = {
            "id": tid,
            "abbreviation": t.get("abbreviation", ""),
            "name": t.get("name", ""),
            "shortName": t.get("shortName", ""),
            "league": t.get("league", {}).get("abbreviation", ""),
            "venue": t.get("venue", {}).get("name", ""),
        }
    TEAM_ID_MAP_LOADED = time.time()


def _load_standings() -> None:
    global STANDINGS_CACHE_LOADED
    if STANDINGS_CACHE and not _cache_stale(STANDINGS_CACHE_LOADED, STANDINGS_CACHE_TTL):
        return
    data = _fetch_json(f"{MLB_API}/standings?leagueId=103,104&season={datetime.now().year}&standingsTypes=regularSeason")
    if not data:
        return
    STANDINGS_CACHE.clear()
    for r in data.get("records", []):
        for tr in r.get("teamRecords", []):
            tid = tr["team"]["id"]
            wp_raw = tr.get("winningPercentage", ".500")
            try:
                wp = float(wp_raw)
            except (ValueError, TypeError):
                wp = 0.500
            STANDINGS_CACHE[tid] = {
                "wins": tr.get("wins", 0),
                "losses": tr.get("losses", 0),
                "win_pct": wp,
                "games_played": tr.get("gamesPlayed", 0),
                "run_differential": tr.get("runDifferential", 0),
                "runs_scored": tr.get("runsScored", 0),
                "runs_allowed": tr.get("runsAllowed", 0),
                "last_ten": "5-5",
            }
    _fill_last_ten()
    STANDINGS_CACHE_LOADED = time.time()


def _fetch_schedule(date_str: str) -> Optional[Any]:
    if date_str in SCHEDULE_CACHE and not _cache_stale(SCHEDULE_CACHE_LOADED.get(date_str, 0), SCHEDULE_CACHE_TTL):
        return SCHEDULE_CACHE[date_str]
    data = _fetch_json(f"{MLB_API}/schedule?date={date_str}&sportId=1")
    SCHEDULE_CACHE[date_str] = data
    SCHEDULE_CACHE_LOADED[date_str] = time.time()
    return data


def get_odds_usage() -> dict:
    return {
        "monthly_requests": ODDS_REQUEST_COUNT["count"],
        "limit": 500,
        "pct": round(ODDS_REQUEST_COUNT["count"] / 500 * 100, 1),
    }


def _fetch_odds_scores(sport_key: str, days_back: int = 3) -> dict:
    if not ODDS_API_KEY:
        return {}
    url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/scores?apiKey={ODDS_API_KEY}&daysFrom={days_back}"
    data = _fetch_json(url)
    if not data or not isinstance(data, list):
        return {}
    results = {}
    for entry in data:
        gid = entry.get("id", "")
        home_score = entry.get("home_score")
        away_score = entry.get("away_score")
        completed = entry.get("completed", False)
        if gid and home_score is not None and away_score is not None and completed:
            results[gid] = {"home_score": home_score, "away_score": away_score, "is_final": True}
    return results


def _fetch_game_score(game_pk: int) -> Optional[dict]:
    box = _fetch_json(f"{MLB_API}/game/{game_pk}/boxscore")
    if not box:
        return None
    status_url = f"{MLB_API}/game/{game_pk}/linescore"
    ls = _fetch_json(status_url)
    if not ls:
        return None
    is_final = ls.get("status", "") == "Final"
    home_score = box.get("teams", {}).get("home", {}).get("score")
    away_score = box.get("teams", {}).get("away", {}).get("score")
    if home_score is None or away_score is None:
        return None
    return {"is_final": is_final, "home_score": home_score, "away_score": away_score}


def _fill_last_ten() -> None:
    if not TEAM_ID_MAP:
        return
    today = datetime.now()
    team_games: dict[int, list[str]] = {tid: [] for tid in TEAM_ID_MAP}
    date_strs = [(today - timedelta(days=d)).strftime("%Y-%m-%d") for d in range(1, 20)]
    schedules: dict[str, Optional[Any]] = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        fut = {ex.submit(_fetch_schedule, ds): ds for ds in date_strs}
        for f in as_completed(fut):
            schedules[fut[f]] = f.result()
    for day_offset in range(1, 20):
        d = today - timedelta(days=day_offset)
        ds = d.strftime("%Y-%m-%d")
        sched = schedules.get(ds)
        if not sched:
            continue
        for date_entry in sched.get("dates", []):
            for g in date_entry.get("games", []):
                if g.get("status", {}).get("detailedState") != "Final":
                    continue
                teams = g.get("teams", {})
                for side, key in [("away", "away"), ("home", "home")]:
                    side_data = teams.get(key, {})
                    tid = side_data.get("team", {}).get("id")
                    if not tid or tid not in team_games:
                        continue
                    if len(team_games[tid]) >= 10:
                        continue
                    score = side_data.get("score", 0)
                    opp_side = "home" if key == "away" else "away"
                    opp_score = teams.get(opp_side, {}).get("score", 0)
                    result = "W" if score > opp_score else "L"
                    team_games[tid].append(result)
        if all(len(games) >= 10 for games in team_games.values()):
            break
    for tid, results in team_games.items():
        last10 = results[:10]
        if len(last10) == 0:
            continue
        w = last10.count("W")
        l = last10.count("L")
        if tid in STANDINGS_CACHE:
            STANDINGS_CACHE[tid]["last_ten"] = f"{w}-{l}"



def _fetch_odds(cfg: Optional[dict] = None, force: bool = False) -> None:
    global ODDS_LAST_FETCHED
    if not ODDS_API_KEY:
        return
    if not force and not _cache_stale(ODDS_LAST_FETCHED, ODDS_FETCH_INTERVAL):
        return
    sport_key = cfg["odds_sport_key"] if cfg else "baseball_mlb"
    url = f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds?apiKey={ODDS_API_KEY}&regions=us&markets=h2h,totals&oddsFormat=american"
    data = _fetch_json(url)
    if data and isinstance(data, list):
        ODDS_CACHE.clear()
        ODDS_CACHE.extend(data)
        ODDS_LAST_FETCHED = time.time()


def _find_odds(home_name: str, away_name: str) -> tuple[Optional[int], Optional[int], Optional[float], Optional[int], Optional[int]]:
    name_map = {
        "Los Angeles Angels of Anaheim": "Los Angeles Angels",
        "Arizona Diamondbacks": "Arizona Diamondbacks",
    }
    home_key = name_map.get(home_name, home_name)
    away_key = name_map.get(away_name, away_name)
    ml_h = None
    ml_a = None
    ou = None
    ou_entries = []
    ou_over_odds = None
    ou_under_odds = None
    for entry in ODDS_CACHE:
        api_home = entry.get("home_team", "")
        api_away = entry.get("away_team", "")
        if api_home.lower() == home_key.lower() and api_away.lower() == away_key.lower():
            pass
        elif api_home.lower() == away_key.lower() and api_away.lower() == home_key.lower():
            pass
        else:
            h_clean = api_home.lower().split(" (")[0].split(" (")[0]
            a_clean = api_away.lower().split(" (")[0].split(" (")[0]
            if h_clean == home_key.lower() and a_clean == away_key.lower():
                pass
            else:
                continue
        bookmakers = entry.get("bookmakers", [])
        if not bookmakers:
            continue
        if ml_h is None:
            for bk in bookmakers:
                for market in bk.get("markets", []):
                    key = market.get("key", "")
                    outcomes = market.get("outcomes", [])
                    if key == "h2h":
                        for o in outcomes:
                            if o.get("name", "").lower() == api_home.lower():
                                ml_h = o.get("price")
                            elif o.get("name", "").lower() == api_away.lower():
                                ml_a = o.get("price")
        for bk in bookmakers:
            for market in bk.get("markets", []):
                if market.get("key") == "totals":
                    outcomes = market.get("outcomes", [])
                    over = next((o for o in outcomes if o.get("name") == "Over"), None)
                    under = next((o for o in outcomes if o.get("name") == "Under"), None)
                    if over is not None:
                        ou_entries.append((over.get("point"), over.get("price"), under.get("price") if under else None))
    if ou_entries:
        ou_entries.sort(key=lambda x: x[0])
        idx = len(ou_entries) // 2
        ou = ou_entries[idx][0]
        ou_over_odds = ou_entries[idx][1]
        ou_under_odds = ou_entries[idx][2]
    return ml_h, ml_a, ou, ou_over_odds, ou_under_odds


def _implied_prob(moneyline: int) -> float:
    if moneyline > 0:
        return 100 / (moneyline + 100)
    return abs(moneyline) / (abs(moneyline) + 100)


def _calc_odds(home_quality: float, away_quality: float, home_stats: dict = None, away_stats: dict = None) -> tuple[int, int, float]:
    diff = home_quality - away_quality
    steepness = 0.08
    win_prob = 1.0 / (1.0 + math.exp(-diff * steepness))
    win_prob = max(0.15, min(0.85, win_prob))
    vig = 0.04
    home_vig = win_prob * (1 + vig)
    away_vig = (1 - win_prob) * (1 + vig)

    def _prob_to_ml(prob: float) -> int:
        prob = max(0.01, min(0.99, prob))
        if prob > 0.5:
            return int(-100 * prob / (1 - prob))
        return int((100 / prob) - 100)

    ml_h = _prob_to_ml(home_vig)
    ml_a = _prob_to_ml(away_vig)
    ml_h = max(-300, min(300, ml_h))
    ml_a = max(-300, min(300, ml_a))

    # Calculate total from actual run data
    if home_stats and away_stats:
        h_rs = home_stats.get("runs_scored", 0) / max(1, home_stats.get("games_played", 60))
        h_ra = home_stats.get("runs_allowed", 0) / max(1, home_stats.get("games_played", 60))
        a_rs = away_stats.get("runs_scored", 0) / max(1, away_stats.get("games_played", 60))
        a_ra = away_stats.get("runs_allowed", 0) / max(1, away_stats.get("games_played", 60))
        expected_home = (h_rs + a_ra) / 2
        expected_away = (a_rs + h_ra) / 2
        total = expected_home + expected_away
        total = round(max(5.0, min(14.0, total)), 1)
    else:
        rs = home_quality + away_quality
        total = round(7.0 + rs / 25, 1)
        total = round(max(5.0, min(14.0, total)), 1)
    return ml_h, ml_a, total


def _team_quality(stats: dict) -> float:
    if not stats:
        return 50.0
    wp = stats.get("win_pct", 0.500)
    rd = stats.get("runs_scored", 0) - stats.get("runs_allowed", 0)
    games = stats.get("games_played", 60)
    rs_per_g = stats.get("runs_scored", 0) / max(1, games)
    ra_per_g = stats.get("runs_allowed", 0) / max(1, games)
    pyth = (rs_per_g ** 2) / (rs_per_g ** 2 + ra_per_g ** 2) if ra_per_g > 0 else 0.5
    blended = wp * 0.5 + pyth * 0.3 + 0.2
    return float(blended * 100 + rd / 8)


def get_todays_games(sport: str = "mlb") -> list[Game]:
    cfg = SPORTS.get(sport)
    if not cfg:
        return []
    today = datetime.now().strftime("%Y-%m-%d")
    if cfg["stats_api"]:
        _load_all_teams()
        _load_standings()
        _fetch_odds(cfg)
        sched = _fetch_json(f"{MLB_API}/schedule?date={today}&sportId=1")
        if not sched:
            return []
        games_data = []
        for d in sched.get("dates", []):
            games_data.extend(d.get("games", []))
        return _build_mlb_games(games_data, today)
    else:
        _fetch_odds(cfg)
        return _build_odds_games(cfg, today)


def _build_mlb_games(games_data: list[dict], today: str) -> list[Game]:
    games: list[Game] = []
    for raw in games_data:
        away = raw["teams"]["away"]
        home = raw["teams"]["home"]
        away_id = away["team"]["id"]
        home_id = home["team"]["id"]

        away_info = TEAM_ID_MAP.get(away_id, {})
        home_info = TEAM_ID_MAP.get(home_id, {})

        away_standings = STANDINGS_CACHE.get(away_id, {})
        home_standings = STANDINGS_CACHE.get(home_id, {})

        away_name = away_info.get("name", "")
        home_name = home_info.get("name", "")

        ml_h, ml_a, ou, ou_over_odds, ou_under_odds = _find_odds(home_name, away_name)
        odds_source = "real" if ml_h is not None else "calculated"
        if ml_h is None:
            hq = _team_quality(home_standings)
            aq = _team_quality(away_standings)
            ml_h, ml_a, ou = _calc_odds(hq, aq, home_standings, away_standings)

        game_id = str(raw.get("gamePk", ""))
        status = raw.get("status", {}).get("detailedState", "Scheduled")
        venue = raw.get("venue", {}).get("name", f"{home_info.get('name', '')} Stadium")
        game_date = raw.get("gameDate", "")

        home_pitcher, away_pitcher = _get_starting_pitchers(raw.get("gamePk", 0))
        inning_state = _get_inning_state(raw.get("gamePk", 0)) if status == "In Progress" else None
        home_score = home.get("score")
        away_score = away.get("score")

        away_team = Team(
            id=str(away_id), name=away_info.get("name", ""),
            abbreviation=away_info.get("abbreviation", ""), league=away_info.get("league", ""),
            wins=away_standings.get("wins", 0), losses=away_standings.get("losses", 0),
            win_pct=away_standings.get("win_pct", 0),
            runs_scored=away_standings.get("runs_scored", 0),
            runs_allowed=away_standings.get("runs_allowed", 0),
            last_ten=away_standings.get("last_ten", "5-5"),
            pitcher=away_pitcher,
        )
        home_team = Team(
            id=str(home_id), name=home_info.get("name", ""),
            abbreviation=home_info.get("abbreviation", ""), league=home_info.get("league", ""),
            wins=home_standings.get("wins", 0), losses=home_standings.get("losses", 0),
            win_pct=home_standings.get("win_pct", 0),
            runs_scored=home_standings.get("runs_scored", 0),
            runs_allowed=home_standings.get("runs_allowed", 0),
            last_ten=home_standings.get("last_ten", "5-5"),
            pitcher=home_pitcher,
        )

        game = Game(
            id=game_id, date=today,
            home_team=home_team, away_team=away_team,
            home_moneyline=ml_h, away_moneyline=ml_a, over_under=ou,
            home_score=home_score, away_score=away_score,
            status=status, venue=venue,
            venue_info=get_venue_info(venue),
            home_pitcher=home_pitcher, away_pitcher=away_pitcher,
            home_implied_prob=round(_implied_prob(ml_h), 4) if ml_h else None,
            away_implied_prob=round(_implied_prob(ml_a), 4) if ml_a else None,
            odds_source=odds_source, inning_state=inning_state, game_date=game_date,
            ou_over_odds=ou_over_odds, ou_under_odds=ou_under_odds,
        )
        games.append(game)
    return games


def _build_odds_games(cfg: dict, today: str) -> list[Game]:
    games: list[Game] = []
    for entry in ODDS_CACHE:
        api_home = entry.get("home_team", "")
        api_away = entry.get("away_team", "")
        gid = entry.get("id", "")
        ml_h = None
        ml_a = None
        ou = None
        ou_over_odds = None
        ou_under_odds = None
        bookmakers = entry.get("bookmakers", [])
        ou_entries = []
        if bookmakers:
            for bk in bookmakers:
                for market in bk.get("markets", []):
                    key = market.get("key", "")
                    outcomes = market.get("outcomes", [])
                    if key == "h2h":
                        if ml_h is None:
                            for o in outcomes:
                                if o.get("name", "").lower() == api_home.lower():
                                    ml_h = o.get("price")
                                elif o.get("name", "").lower() == api_away.lower():
                                    ml_a = o.get("price")
                    elif key == "totals":
                        over = next((o for o in outcomes if o.get("name") == "Over"), None)
                        under = next((o for o in outcomes if o.get("name") == "Under"), None)
                        if over is not None:
                            ou_entries.append((over.get("point"), over.get("price"), under.get("price") if under else None))
        if ou_entries:
            ou_entries.sort(key=lambda x: x[0])
            idx = len(ou_entries) // 2
            ou = ou_entries[idx][0]
            ou_over_odds = ou_entries[idx][1]
            ou_under_odds = ou_entries[idx][2]

        home_team = Team(id="home", name=api_home, abbreviation=api_home[:3].upper(), league="")
        away_team = Team(id="away", name=api_away, abbreviation=api_away[:3].upper(), league="")
        game = Game(
            id=gid, date=today,
            home_team=home_team, away_team=away_team,
            home_moneyline=ml_h, away_moneyline=ml_a, over_under=ou,
            home_score=None, away_score=None,
            status="Scheduled", venue="",
            home_implied_prob=round(_implied_prob(ml_h), 4) if ml_h else None,
            away_implied_prob=round(_implied_prob(ml_a), 4) if ml_a else None,
            odds_source="real",
            ou_over_odds=ou_over_odds, ou_under_odds=ou_under_odds,
            game_date=entry.get("commence_time", ""),
        )
        games.append(game)
    return games
