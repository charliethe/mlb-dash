import json
import os
import logging
from datetime import datetime, timedelta
from typing import Optional
from models import BetRecommendation

logger = logging.getLogger(__name__)

TRACKER_FILE = os.path.join(os.path.dirname(__file__), "data", "bet_history.json")
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "data", "config.json")

DEFAULT_CONFIG = {"bankroll": 100.0, "unit_size": 1.0}


class TrackedPick:
    def __init__(self, pick: BetRecommendation, game_date: str, sport: str = "mlb"):
        self.game_id = pick.game_id
        self.matchup = pick.matchup
        self.bet_type = pick.bet_type
        self.side = pick.side
        self.odds = pick.odds
        self.line = pick.line
        self.confidence = pick.confidence
        self.edge = pick.edge
        self.kelly_fraction = pick.kelly_fraction
        self.reasoning = pick.reasoning
        self.game_date = game_date
        self.sport = sport
        self.tracked_at = datetime.now().isoformat()
        self.status = "pending"
        self.result: Optional[str] = None
        self.units: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "game_id": self.game_id,
            "matchup": self.matchup,
            "bet_type": self.bet_type,
            "side": self.side,
            "odds": self.odds,
            "line": self.line,
            "confidence": self.confidence,
            "edge": self.edge,
            "kelly_fraction": self.kelly_fraction,
            "reasoning": self.reasoning,
            "game_date": self.game_date,
            "sport": self.sport,
            "tracked_at": self.tracked_at,
            "status": self.status,
            "result": self.result,
            "units": self.units,
        }

    @staticmethod
    def from_dict(d: dict):
        pick = BetRecommendation(
            game_id=d["game_id"], matchup=d["matchup"], bet_type=d["bet_type"],
            side=d["side"], odds=d.get("odds"), line=d.get("line"),
            confidence=d["confidence"], edge=d["edge"], reasoning=d.get("reasoning", []),
            kelly_fraction=d.get("kelly_fraction"),
        )
        tp = TrackedPick(pick, d.get("game_date", ""), d.get("sport", "mlb"))
        tp.tracked_at = d.get("tracked_at", tp.tracked_at)
        tp.status = d.get("status", "pending")
        tp.result = d.get("result")
        tp.units = d.get("units")
        return tp


class BetTracker:
    def __init__(self):
        self.picks: dict[str, TrackedPick] = {}
        self.config: dict = {}
        self._load_config()
        self._load()

    def _load_config(self) -> None:
        try:
            if os.path.exists(CONFIG_FILE):
                with open(CONFIG_FILE) as f:
                    self.config = json.load(f)
            else:
                self.config = dict(DEFAULT_CONFIG)
        except Exception as e:
            logger.warning("Failed to load config: %s", e)
            self.config = dict(DEFAULT_CONFIG)

    def save_config(self, updates: dict) -> dict:
        self.config.update(updates)
        try:
            os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
            with open(CONFIG_FILE, "w") as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logger.warning("Failed to save config: %s", e)
        return self.config

    def _load(self) -> None:
        if not os.path.exists(TRACKER_FILE):
            return
        try:
            with open(TRACKER_FILE) as f:
                data = json.load(f)
            for entry in data:
                tp = TrackedPick.from_dict(entry)
                key = f"{tp.game_id}_{tp.bet_type}_{tp.side}"
                self.picks[key] = tp
            self._expire_stale(datetime.now())
            self._archive_old(datetime.now())
        except Exception as e:
            logger.warning("Failed to load bet history: %s", e)

    def _save(self) -> None:
        try:
            os.makedirs(os.path.dirname(TRACKER_FILE), exist_ok=True)
            with open(TRACKER_FILE, "w") as f:
                json.dump([p.to_dict() for p in self.picks.values()], f, indent=2)
        except Exception as e:
            logger.warning("Failed to save bet history: %s", e)

    def track(self, pick: BetRecommendation, game_date: str, sport: str = "mlb") -> None:
        key = f"{pick.game_id}_{pick.bet_type}_{pick.side}"
        if key not in self.picks:
            self.picks[key] = TrackedPick(pick, game_date, sport)
            self._save()

    def _resolve_single(self, tp, home_score, away_score) -> None:
        if tp.bet_type == "moneyline":
            winner = "home" if (home_score is not None and away_score is not None and home_score > away_score) else "away" if (home_score is not None and away_score is not None) else None
            if winner is None:
                return
            tp.result = "won" if tp.side == winner else "lost"
        elif tp.bet_type == "over_under":
            total = None
            if home_score is not None and away_score is not None:
                total = home_score + away_score
            if total is None or tp.line is None:
                return
            if tp.side == "over":
                tp.result = "won" if total > tp.line else "push" if total == tp.line else "lost"
            else:
                tp.result = "won" if total < tp.line else "push" if total == tp.line else "lost"
        if tp.result == "won":
            tp.units = _calculate_units(tp.odds)
            tp.status = "won"
        elif tp.result == "lost":
            tp.units = -1.0
            tp.status = "lost"
        elif tp.result == "push":
            tp.units = 0.0
            tp.status = "push"

    def resolve_games(self, games_data: list[dict]) -> None:
        now = datetime.now()
        for g in games_data:
            gid = str(g.get("id", ""))
            status = g.get("status", "")
            if status != "Final":
                continue
            home_score = g.get("home_score")
            away_score = g.get("away_score")
            for key, tp in list(self.picks.items()):
                if tp.game_id != gid or tp.status != "pending":
                    continue
                self._resolve_single(tp, home_score, away_score)

        pending = [tp for tp in self.picks.values() if tp.status == "pending"]
        if pending:
            self._resolve_past_pending(now)
            self._expire_stale(now)
        self._archive_old(now)
        self._save()

    def _resolve_past_pending(self, now: datetime) -> None:
        try:
            from data_fetcher import _fetch_game_score, _fetch_odds_scores
            from sport_config import SPORTS
        except ImportError:
            return

        # Group pending picks by sport
        pending = [tp for tp in self.picks.values() if tp.status == "pending"]
        by_sport: dict[str, list] = {}
        for tp in pending:
            by_sport.setdefault(tp.sport, []).append(tp)

        for sport, sport_picks in by_sport.items():
            cfg = SPORTS.get(sport)
            if sport == "mlb":
                # MLB: use MLB stats API boxscore
                seen_gids = set()
                for tp in sport_picks:
                    if tp.game_id in seen_gids:
                        continue
                    try:
                        gid_int = int(tp.game_id)
                    except (ValueError, TypeError):
                        continue
                    seen_gids.add(tp.game_id)
                    result = _fetch_game_score(gid_int)
                    if not result or not result.get("is_final"):
                        continue
                    home_score = result["home_score"]
                    away_score = result["away_score"]
                    for tp2 in self.picks.values():
                        if tp2.game_id == tp.game_id and tp2.status == "pending":
                            self._resolve_single(tp2, home_score, away_score)
            else:
                # Non-MLB: use Odds API scores endpoint
                if not cfg:
                    continue
                scores = _fetch_odds_scores(cfg["odds_sport_key"])
                if not scores:
                    continue
                for tp in sport_picks:
                    result = scores.get(tp.game_id)
                    if not result or not result.get("is_final"):
                        continue
                    for tp2 in self.picks.values():
                        if tp2.game_id == tp.game_id and tp2.status == "pending":
                            self._resolve_single(tp2, result["home_score"], result["away_score"])

    def _archive_old(self, now: datetime) -> None:
        cutoff = now - timedelta(days=30)
        before = len(self.picks)
        self.picks = {
            k: tp for k, tp in self.picks.items()
            if tp.status == "pending"
            or (tp.game_date and tp.tracked_at and
                datetime.fromisoformat(tp.tracked_at.replace("Z", "+00:00")) > cutoff)
        }
        after = len(self.picks)
        if before != after:
            logger.info("Archived %d old picks (%d remaining)", before - after, after)

    def _expire_stale(self, now: datetime) -> None:
        for tp in self.picks.values():
            if tp.status != "pending":
                continue
            if tp.game_date:
                try:
                    game_date = datetime.fromisoformat(tp.game_date.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    game_date = None
                if game_date and (now - game_date) > timedelta(hours=48):
                    tp.status = "expired"
                    tp.result = "expired"
                    tp.units = 0.0

    def get_stats(self) -> dict:
        total = len([p for p in self.picks.values() if p.status != "pending"])
        won = sum(1 for p in self.picks.values() if p.status == "won")
        lost = sum(1 for p in self.picks.values() if p.status == "lost")
        pushes = sum(1 for p in self.picks.values() if p.status == "push")
        pending = sum(1 for p in self.picks.values() if p.status == "pending")
        expired = sum(1 for p in self.picks.values() if p.status == "expired")
        resolved_units = sum(p.units for p in self.picks.values() if p.units is not None and p.status in ("won", "lost", "push"))
        starting_bankroll = self.config.get("bankroll", DEFAULT_CONFIG["bankroll"])
        unit_size = self.config.get("unit_size", DEFAULT_CONFIG["unit_size"])
        current_bankroll = starting_bankroll + resolved_units * unit_size
        roi = (resolved_units / starting_bankroll) * 100 if starting_bankroll > 0 else 0
        return {
            "total": total,
            "won": won,
            "lost": lost,
            "pushes": pushes,
            "pending": pending,
            "expired": expired,
            "win_rate": round(won / total, 3) if total > 0 else 0,
            "total_units": round(resolved_units, 2),
            "total_dollars": round(resolved_units * unit_size, 2),
            "starting_bankroll": starting_bankroll,
            "current_bankroll": round(current_bankroll, 2),
            "unit_size": unit_size,
            "roi": round(roi, 1),
            "picks": [p.to_dict() for p in sorted(
                self.picks.values(),
                key=lambda x: x.tracked_at,
                reverse=True,
            )],
        }

    def get_history(self) -> list[dict]:
        day_groups: dict[str, list[TrackedPick]] = {}
        for tp in self.picks.values():
            day = tp.tracked_at[:10] if tp.tracked_at else ""
            if not day:
                continue
            day_groups.setdefault(day, []).append(tp)
        cumulative = 0.0
        history = []
        for day in sorted(day_groups.keys()):
            day_units = sum(
                tp.units for tp in day_groups[day]
                if tp.units is not None and tp.status in ("won", "lost", "push")
            )
            cumulative += day_units
            history.append({"date": day, "units": round(day_units, 2), "cumulative": round(cumulative, 2)})
        return history

    def get_csv(self) -> str:
        lines = ["date,matchup,type,side,odds,line,confidence,edge,kelly,sport,status,result,units"]
        for tp in sorted(self.picks.values(), key=lambda x: x.tracked_at or ""):
            lines.append(
                f"{tp.tracked_at[:10]},{tp.matchup},{tp.bet_type},{tp.side},"
                f"{tp.odds or ''},{tp.line or ''},{tp.confidence},{tp.edge},"
                f"{tp.kelly_fraction or ''},{tp.sport},{tp.status},{tp.result or ''},{tp.units or ''}"
            )
        return "\n".join(lines)


def _calculate_units(odds: Optional[int]) -> float:
    if odds is None:
        return 1.0
    if odds > 0:
        return odds / 100
    return 100 / abs(odds)


tracker = BetTracker()
