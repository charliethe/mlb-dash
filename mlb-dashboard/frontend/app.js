const API_BASE = '';

const LOADING_MSGS = [
  'Convincing the model to do some work...',
  'Crunching numbers so you don\'t have to...',
  'Consulting the algorithm gods...',
  'Sharpening the pencils...',
  'Doing math. Out loud. In public...',
  'Teaching the computer about sportsball...',
  'Googling "how do sports work"...',
  'Bribing the oddsmakers...',
  'We\'ll get it right eventually...',
  'Calculating the meaning of life...',
  'Petting the database...',
  'Running the numbers. They\'re not fast runners...',
];

const TOAST_MSGS = {
  refresh: ['Data refreshed. Your eyes are welcome.', 'Fresh data, same questionable decisions.', 'Updated. Try not to lose it all.', 'New data loaded. No refunds.'],
  addSlip: ['Added to slip. Don\'t blame us.', 'In the slip. We\'re not responsible.', 'Locked in. Nervous yet?', 'Added. Your funeral.'],
  removeSlip: ['Removed. Playing it safe, huh?', 'Gone. This one\'s gonna hit, watch.', 'Removed. The model is disappointed.'],
  void: ['Voided. Pretend it never happened.', 'Gone. We\'ll never speak of this.', 'Poof. Like it never existed.'],
  error: ['Something broke. Classic.', 'Well that didn\'t work. Shocking.', 'Error. We blame the computer.'],
  clear: ['Slip cleared. Clean conscience.', 'Reset. Like it never happened.', 'Cleared. Fresh start. No judgment.'],
};

const FOOTER_TIPS = [
  'The house always wins. Eventually.',
  'Bet with your head, not over it.',
  'A "sure thing" is how they get you.',
  'If it seems too good to be true, the line moved.',
  'The best bet is sometimes no bet.',
  'Even a broken clock is right twice a day.',
  'Past performance does not guarantee future results.',
  'This is not financial advice. It\'s not even good advice.',
  'The model has feelings too. Mostly anxiety.',
  'Someone out there is betting on the other side. They can\'t both be right.',
  'Chasing losses is how you end up betting on the WNBA in February.',
  'A wise person once said "I should not have bet that."',
];

const TEAM_COLORS = {
  mlb: {
    ARI: '#A71930', ATH: '#003831', ATL: '#CE1141', BAL: '#DF4601',
    BOS: '#BD3039', CHC: '#0E3386', CIN: '#C6011F', CLE: '#00385D',
    COL: '#33006F', CWS: '#27251F', DET: '#0C2C56', HOU: '#002D62',
    KC: '#004687', LAA: '#BA0021', LAD: '#005A9C', MIA: '#00A3E0',
    MIL: '#FFC52F', MIN: '#002B5C', NYM: '#002D72', NYY: '#003087',
    PHI: '#E81828', PIT: '#FDB827', SD: '#2F241D', SEA: '#0C2C56',
    SF: '#FD5A1E', STL: '#C41E3A', TB: '#092C5C', TEX: '#003278',
    TOR: '#134A8E', WSH: '#AB0003',
  },
  nba: {
    LAL: '#552583', BOS: '#007A33', GSW: '#1D428A', CHI: '#CE1141',
    MIA: '#98002E', PHI: '#006BB6', DAL: '#007DC5', MIL: '#00471B',
    LAC: '#C8102E', PHX: '#E56020', UTA: '#002B5C', POR: '#E03A3E',
    OKC: '#007AC1', CLE: '#860038', HOU: '#CE1141', ORL: '#0077C0',
    IND: '#002D62', WAS: '#E31837', BKN: '#000000', CHA: '#1D1160',
    NYK: '#F58426', TOR: '#CE1141', NO: '#0C2340', SA: '#C4CED4',
    ATL: '#E03A3E', MEM: '#5D76A9', SAC: '#5A2D81', DEN: '#0E2240',
    MIN: '#0C2340', DET: '#C8102E',
  },
  nfl: {
    KC: '#E31837', SF: '#B3995D', BUF: '#00338D', CIN: '#FB4F14',
    LAC: '#0080C6', PHI: '#004C54', DAL: '#041E42', NE: '#002244',
    GB: '#203731', LV: '#000000', MIA: '#008E97', PIT: '#FFB612',
    CHI: '#0B162A', TB: '#D50A0A', JAX: '#006778', NYJ: '#125740',
    HOU: '#03202F', DEN: '#FB4F14', NO: '#D3BC8D', SEA: '#002244',
    ARI: '#97233F', IND: '#002C5F', WAS: '#5A1414', TEN: '#0C2340',
    CAR: '#0085CA', CLE: '#311D00', MIN: '#4F2683', ATL: '#A71930',
    NYG: '#0B2265', DET: '#0076B6', LAR: '#003594', BAL: '#241773',
  },
  nhl: {
    CIN: '#FF3C00', MIA: '#008E97', PHI: '#004C54', BUF: '#00338D',
    CHI: '#0B162A', PIT: '#FFB612', ARI: '#97233F', DEN: '#FB4F14',
  },
};

const EMPTY_SVG = (type) => {
  if (type === 'games') return '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
  if (type === 'picks') return '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>';
  if (type === 'record') return '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>';
  return '';
};

const REFRESH_INTERVALS = [
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
  { label: '2m', value: 120000 },
  { label: '5m', value: 300000 },
  { label: 'Off', value: 0 },
];

let allGames = [];
let allPicks = [];
let allAnalysisResults = [];
let picksByGameId = {};
let analysisByGameId = {};
let lastTrackingData = null;
let lastSuccessfulRefresh = 0;
let staleWarningInterval = null;
let isAutoRefresh = false;
let autoRefreshTimer = null;
let refreshFailures = 0;
let currentSport = localStorage.getItem('selectedSport') || 'mlb';
let previousOdds = {};
let betslipPicks = [];
let countdownInterval = null;
let savedScrollY = 0;
let currentRefreshInterval = parseInt(localStorage.getItem('refreshInterval') || '120000');
let searchValue = '';

function $(id) { return document.getElementById(id); }

async function fetchAPI(endpoint) {
  const sep = endpoint.includes('?') ? '&' : '?';
  const res = await fetch(`${API_BASE}${endpoint}${sep}sport=${currentSport}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function formatMoneyline(ml) {
  if (!ml) return '-';
  return ml > 0 ? `+${ml}` : `${ml}`;
}

function moneylineClass(ml) {
  if (!ml) return '';
  return ml < 0 ? 'favorite' : 'underdog';
}

function confidenceColor(conf) {
  if (conf >= 0.75) return 'var(--green)';
  if (conf >= 0.6) return 'var(--yellow)';
  return 'var(--red)';
}

function confidenceLabel(conf) {
  if (conf >= 0.75) return 'HIGH';
  if (conf >= 0.6) return 'MED';
  return 'LOW';
}

function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ago`;
}

function teamColor(abbr, sport) {
  const map = TEAM_COLORS[sport || currentSport];
  return (map && map[abbr.toUpperCase()]) || 'var(--text-secondary)';
}

// ---- Countdown ----
function startCountdowns() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    document.querySelectorAll('[data-countdown]').forEach(el => {
      const target = new Date(el.dataset.countdown);
      const diff = target - Date.now();
      if (diff <= 0) { el.textContent = 'Starting now'; return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = `${h}h ${m}m ${s}s`;
    });
  }, 1000);
}

// ---- Stale data warning ----
function updateStaleWarning() {
  const el = $('stale-warning');
  if (!el) return;
  if (!lastSuccessfulRefresh) { el.classList.remove('visible'); return; }
  const age = Date.now() - lastSuccessfulRefresh;
  if (age > 120000) {
    el.textContent = `Data may be stale — last updated ${timeAgo(lastSuccessfulRefresh)}`;
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
  }
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ---- Toast ----
let toastTimeout = null;
function showToast(message, type = 'info') {
  const el = $('toast');
  if (!el) return;
  if (typeof message === 'object') message = pickRandom(message);
  el.textContent = message;
  el.className = `toast toast-${type} visible`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('visible'), 3000);
}

// ---- Refresh indicator ----
let loadingTimer = null;

function setRefreshing(active) {
  const dot = $('refresh-indicator');
  if (dot) dot.classList.toggle('active', active);
  const bar = $('load-bar');
  if (bar) bar.classList.toggle('active', active);
  const btn = $('refresh-btn');
  if (!btn) return;
  if (active) {
    btn.textContent = 'Loading...';
    let elapsed = 0;
    if (loadingTimer) clearInterval(loadingTimer);
    loadingTimer = setInterval(() => {
      elapsed += 5;
      if (elapsed >= 20 && !lastSuccessfulRefresh) {
        btn.textContent = '⚠ Still loading...';
      } else if (elapsed >= 40 && !lastSuccessfulRefresh) {
        btn.textContent = '⏳ MLB API is slow...';
      }
    }, 5000);
  } else {
    if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; }
    if (lastSuccessfulRefresh) btn.textContent = '⟳ Refresh Data';
  }
}

// ---- Bet slip ----
function toggleBetSlip(pick) {
  const key = `${pick.game_id}_${pick.bet_type}_${pick.side}`;
  const idx = betslipPicks.findIndex(p => `${p.game_id}_${p.bet_type}_${p.side}` === key);
  if (idx >= 0) betslipPicks.splice(idx, 1);
  else betslipPicks.push(pick);
  renderBetSlip();
}

function renderBetSlip() {
  const el = $('betslip-content');
  const count = $('betslip-count');
  if (count) count.textContent = betslipPicks.length > 0 ? `(${betslipPicks.length})` : '';
  if (betslipPicks.length === 0) {
    el.innerHTML = `<div class="betslip-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      <span>Click a pick to add it</span>
    </div>`;
    return;
  }
  el.innerHTML = `
    <div class="betslip-items">${betslipPicks.map(p => {
      const key = `${p.game_id}_${p.bet_type}_${p.side}`;
      const sideLabel = p.bet_type === 'moneyline'
        ? (p.side === 'home' ? p.matchup.split(' @ ')[1] : p.matchup.split(' @ ')[0])
        : `${p.side.toUpperCase()} ${p.line?.toFixed(1)}`;
      return `<div class="betslip-item" onclick="toggleBetSlip(allPicks.find(x => '${key}' === x.game_id+'_'+x.bet_type+'_'+x.side))">
        <span class="betslip-item-matchup">${p.matchup}</span>
        <span class="betslip-item-type">${p.bet_type === 'moneyline' ? 'ML' : 'O/U'}</span>
        <span class="betslip-item-side">${sideLabel}</span>
        <span class="betslip-item-odds">${formatMoneyline(p.odds)}</span>
        <span class="betslip-item-remove">✕</span>
      </div>`;
    }).join('')}</div>
    <button class="btn-primary" style="margin-top:8px" onclick="betslipPicks=[];renderBetSlip();showToast(TOAST_MSGS.clear,'info')">Clear All</button>
  `;
}

// ---- Populate game filter ----
function populateGameFilter() {
  const sel = $('game-filter');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="all">All Games</option>';
  allGames.forEach(g => {
    sel.innerHTML += `<option value="${g.id}">${g.away_team.abbreviation} @ ${g.home_team.abbreviation}</option>`;
  });
  sel.value = current;
}

// ---- Line movement ----
function renderLineMovement(game, side) {
  const key = `${game.id}_${side}`;
  const cur = side === 'home' ? game.home_moneyline : game.away_moneyline;
  const prev = previousOdds[key];
  if (!prev || !cur || prev === cur) {
    previousOdds[key] = cur;
    return '';
  }
  previousOdds[key] = cur;
  return cur > prev ? ' <span class="move-up">↑</span>' : ' <span class="move-down">↓</span>';
}

// ---- Render: sidebar mini-pick ----
function renderMiniPick(pick) {
  const confClass = pick.confidence >= 0.75 ? 'conf-high' : pick.confidence >= 0.6 ? 'conf-med' : 'conf-low';
  const sideLabel = pick.bet_type === 'moneyline'
    ? (pick.side === 'home' ? pick.matchup.split(' @ ')[1] : pick.matchup.split(' @ ')[0])
    : `${pick.side.toUpperCase()} ${pick.line?.toFixed(1)}`;
  const statusIcon = pick.status === 'won' ? '✓' : pick.status === 'lost' ? '✗' : pick.status === 'push' ? '=' : '';
  return `
    <div class="mini-pick ${confClass}" data-game-id="${pick.game_id}" onclick="switchToGame('${pick.game_id}')">
      <div class="pick-matchup">${pick.matchup} ${statusIcon ? `<span class="mini-status ${pick.status}">${statusIcon}</span>` : ''}</div>
      <div class="pick-detail">${pick.bet_type === 'moneyline' ? 'ML' : 'O/U'} · ${sideLabel} · ${formatMoneyline(pick.odds)}</div>
      <div class="pick-conf">
        ${(pick.confidence * 100).toFixed(0)}% ${confidenceLabel(pick.confidence)}
        ${pick.kelly_fraction != null && pick.kelly_fraction > 0 ? ` · ${(pick.kelly_fraction * 100).toFixed(1)}%` : ''}
        ${pick.status === 'won' ? `+${pick.units?.toFixed(2) ?? '0'}u` : pick.status === 'lost' ? `${pick.units?.toFixed(2) ?? '0'}u` : pick.status === 'push' ? '0.00u' : ''}
      </div>
    </div>
  `;
}

// ---- Trend text ----
function renderTrendText(lastTen) {
  if (!lastTen) return '';
  const parts = lastTen.split('-').map(Number);
  const w = parts[0] || 0;
  const l = parts[1] || 0;
  if (w >= 8) return '<span class="trend-pill trend-hot">HOT</span>';
  if (w >= 6) return '<span class="trend-pill trend-warm">WARM</span>';
  if (l >= 8) return '<span class="trend-pill trend-cold">COLD</span>';
  if (l >= 6) return '<span class="trend-pill trend-cool">COOL</span>';
  return '<span class="trend-pill trend-neutral">.500</span>';
}

// ---- Sidebar trends widget ----
function renderPickTrends() {
  const el = $('pick-trends');
  if (!el) return;
  const resolved = (lastTrackingData?.picks || []).filter(p => p.status !== 'pending');
  if (resolved.length < 3) { el.innerHTML = ''; return; }
  const byType = {};
  const byConf = { high: [], med: [], low: [] };
  resolved.forEach(p => {
    if (!byType[p.bet_type]) byType[p.bet_type] = [];
    byType[p.bet_type].push(p);
    if (p.confidence >= 0.75) byConf.high.push(p);
    else if (p.confidence >= 0.6) byConf.med.push(p);
    else byConf.low.push(p);
  });
  const fmt = (arr) => {
    const w = arr.filter(p => p.status === 'won').length;
    const l = arr.filter(p => p.status === 'lost').length;
    const t = w + l;
    if (t === 0) return '<span class="trend-neutral">—</span>';
    const pct = (w / t * 100).toFixed(0);
    const cls = w >= l ? 'trend-warm' : 'trend-cool';
    return `<span class="${cls}">${w}-${l} (${pct}%)</span>`;
  };
  el.innerHTML = `
    <div class="trends-grid">
      <div class="trends-item"><span class="trends-label">Moneyline</span>${fmt(byType.moneyline || [])}</div>
      <div class="trends-item"><span class="trends-label">O/U</span>${fmt(byType.over_under || [])}</div>
      <div class="trends-item"><span class="trends-label">HIGH Conf</span>${fmt(byConf.high)}</div>
      <div class="trends-item"><span class="trends-label">MED Conf</span>${fmt(byConf.med)}</div>
      <div class="trends-item"><span class="trends-label">LOW Conf</span>${fmt(byConf.low)}</div>
    </div>
  `;
}

// ---- Trends tab ----
function renderTrends(trackingData) {
  const el = $('trends-content');
  if (!el) return;

  // ---- Today's game trends ----
  const trendsCards = allAnalysisResults.map(r => {
    const g = r.game;
    const ht = g.home_team;
    const at = g.away_team;
    const hRunsPerG = (ht.runs_scored / (ht.wins + ht.losses || 1)).toFixed(1);
    const aRunsPerG = (at.runs_scored / (at.wins + at.losses || 1)).toFixed(1);
    const hRunsAllowedPerG = (ht.runs_allowed / (ht.wins + ht.losses || 1)).toFixed(1);
    const aRunsAllowedPerG = (at.runs_allowed / (at.wins + at.losses || 1)).toFixed(1);
    const v = g.venue_info;
    const venueNote = v && v.label !== 'Unknown' ? `${v.label} (${v.park_factor.toFixed(2)} PF, ${v.overs_rate} O/U)` : '';
    const pickNote = r.recommendations.length > 0
      ? r.recommendations.map(p => `${p.bet_type === 'moneyline' ? 'ML' : 'O/U'} ${p.side.toUpperCase()} (${p.edge}% edge)`).join(', ')
      : 'No edge found';
    return `
      <div class="trend-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong style="font-size:13px">${at.abbreviation} @ ${ht.abbreviation}</strong>
          <span style="font-size:10px;color:var(--text-muted)">${g.venue}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">
          <div style="background:var(--bg-secondary);padding:6px 8px;border-radius:4px">
            <strong>${at.abbreviation}</strong>
            <div style="color:var(--text-secondary);margin-top:2px">${at.wins}-${at.losses} · ${at.last_ten} L10</div>
            <div style="color:var(--text-secondary)">${aRunsPerG} RS/g · ${aRunsAllowedPerG} RA/g</div>
            ${g.away_pitcher ? `<div style="color:var(--text-secondary)">SP: ${g.away_pitcher.name} (${g.away_pitcher.era.toFixed(2)} ERA)</div>` : ''}
            <div style="margin-top:3px">Model: <strong>${(r.away_win_prob * 100).toFixed(0)}%</strong> WP</div>
          </div>
          <div style="background:var(--bg-secondary);padding:6px 8px;border-radius:4px">
            <strong>${ht.abbreviation}</strong>
            <div style="color:var(--text-secondary);margin-top:2px">${ht.wins}-${ht.losses} · ${ht.last_ten} L10</div>
            <div style="color:var(--text-secondary)">${hRunsPerG} RS/g · ${hRunsAllowedPerG} RA/g</div>
            ${g.home_pitcher ? `<div style="color:var(--text-secondary)">SP: ${g.home_pitcher.name} (${g.home_pitcher.era.toFixed(2)} ERA)</div>` : ''}
            <div style="margin-top:3px">Model: <strong>${(r.home_win_prob * 100).toFixed(0)}%</strong> WP</div>
          </div>
        </div>
        ${venueNote ? `<div style="font-size:10px;color:var(--yellow);margin-top:4px">🏟 ${venueNote}</div>` : ''}
        <div style="font-size:10px;color:var(--text-secondary);margin-top:2px">Picks: ${pickNote}</div>
      </div>
    `;
  }).join('');

  // ---- Key insights from today's games ----
  const sortedByWP = [...allAnalysisResults].sort((a, b) => Math.max(a.home_win_prob, a.away_win_prob) - Math.max(b.home_win_prob, b.away_win_prob)).reverse();
  const biggestFav = sortedByWP[0];
  const favLabel = biggestFav
    ? `${biggestFav.game.home_win_prob > 0.6 ? biggestFav.game.home_team.abbreviation : biggestFav.game.away_team.abbreviation} (${(Math.max(biggestFav.home_win_prob, biggestFav.away_win_prob) * 100).toFixed(0)}% WP vs ${biggestFav.game.away_team.abbreviation})`
    : '';

  const bestLast10 = [...allGames].sort((a, b) => {
    const aW = parseInt((a.home_team.last_ten || '0-0').split('-')[0]) + parseInt((a.away_team.last_ten || '0-0').split('-')[0]);
    const bW = parseInt((b.home_team.last_ten || '0-0').split('-')[0]) + parseInt((b.away_team.last_ten || '0-0').split('-')[0]);
    return bW - aW;
  });
  const hottest = bestLast10[0];
  const hotTeam = hottest
    ? `${hottest.home_team.last_ten.split('-')[0] >= hottest.away_team.last_ten.split('-')[0] ? hottest.home_team.abbreviation : hottest.away_team.abbreviation} (${Math.max(...[hottest.home_team.last_ten, hottest.away_team.last_ten].map(x => parseInt(x.split('-')[0])))}-${Math.min(...[hottest.home_team.last_ten, hottest.away_team.last_ten].map(x => parseInt(x.split('-')[1])))} L10)`
    : '';

  // ---- Venue grid ----
  const venues = [...new Set(allGames.map(g => g.venue_info).filter(v => v && v.label !== 'Unknown').map(v => `${v.name} (${v.label}, ${v.park_factor.toFixed(2)} PF, ${v.overs_rate} O/U)`))].join(' · ');

  // ---- Historical tracking trends ----
  const resolved = (trackingData?.picks || []).filter(p => p.status !== 'pending').sort((a, b) => new Date(a.tracked_at) - new Date(b.tracked_at));
  const hasPicks = resolved.length >= 3;

  const bankrollStart = 100;
  let cum = bankrollStart;
  const points = resolved.map(p => { cum += (p.units || 0); return { date: p.tracked_at, value: cum, units: p.units || 0, status: p.status }; });
  const bankrollChart = hasPicks ? renderSparklineChart(points, bankrollStart, 'Bankroll') : '';

  const byType = {};
  const byConf = { high: [], med: [], low: [] };
  resolved.forEach(p => {
    if (!byType[p.bet_type]) byType[p.bet_type] = [];
    byType[p.bet_type].push(p);
    if (p.confidence >= 0.75) byConf.high.push(p);
    else if (p.confidence >= 0.6) byConf.med.push(p);
    else byConf.low.push(p);
  });

  const barHtml = (arr, label, color) => {
    if (arr.length === 0) return '';
    const w = arr.filter(p => p.status === 'won').length;
    const l = arr.filter(p => p.status === 'lost').length;
    const total = w + l;
    if (total === 0) return '';
    const wp = (w / total) * 100;
    return `<div class="trend-bar-row"><span class="trend-bar-label">${label}</span><div class="trend-bar-track" style="width:180px"><div class="trend-bar-fill" style="width:${wp}%;background:${color}"></div></div><span class="trend-bar-pct">${wp.toFixed(0)}% (${w}-${l})</span></div>`;
  };

  const ml = byType.moneyline || [];
  const ou = byType.over_under || [];

  const recentResults = resolved.slice(-15).reverse();
  const recentHtml = recentResults.map(p => {
    const cls = p.status === 'won' ? 'bar-won' : p.status === 'lost' ? 'bar-lost' : 'bar-push';
    const h = p.status === 'won' ? Math.abs(p.units || 0) * 12 : 12;
    return `<div class="recent-bar ${cls}" style="height:${Math.max(h, 4)}px" title="${p.matchup}: ${p.status.toUpperCase()} ${p.units > 0 ? '+' : ''}${p.units?.toFixed(2)}u"></div>`;
  }).join('');

  el.innerHTML = `
    <div class="trends-view">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="trend-card">
          <h3>🔥 Today's Best Bets</h3>
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">Highest confidence: ${biggestFav ? `${biggestFav.game.away_team.abbreviation} @ ${biggestFav.game.home_team.abbreviation}` : '—'}</div>
          <div style="font-size:11px;color:var(--text-secondary)">Model's biggest favorite: ${favLabel || '—'}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">Hottest team today: ${hotTeam || '—'}</div>
        </div>
        <div class="trend-card">
          <h3>🏟️ Today's Venues</h3>
          <div style="font-size:11px;color:var(--text-secondary);line-height:1.6">
            ${venues || 'No venue data'}
          </div>
        </div>
      </div>

      <h3 style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:6px;font-weight:700">Matchup Trends</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        ${trendsCards}
      </div>

      ${hasPicks ? `
      <h3 style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:6px;font-weight:700">Track Record</h3>
      <div class="trends-grid-main">
        <div class="trend-card">
          <h3>Bankroll</h3>
          <div class="trend-chart-container">${bankrollChart}</div>
          <div class="trend-stats-row">
            <span>Start: <strong>$${bankrollStart.toFixed(0)}</strong></span>
            <span>Current: <strong style="color:${points[points.length - 1].value >= bankrollStart ? 'var(--green)' : 'var(--red)'}">$${points[points.length - 1].value.toFixed(2)}</strong></span>
            <span>Peak: <strong>$${Math.max(...points.map(p => p.value)).toFixed(2)}</strong></span>
          </div>
        </div>
        <div>
          <div class="trend-card" style="margin-bottom:8px">
            <h3>By Type</h3>
            ${barHtml(ml, 'ML', 'var(--gold)')}
            ${barHtml(ou, 'O/U', 'var(--gold)')}
            ${ml.length === 0 && ou.length === 0 ? '<div class="trend-empty">No picks yet</div>' : ''}
          </div>
          <div class="trend-card">
            <h3>By Confidence</h3>
            ${barHtml(byConf.high, 'HIGH', 'var(--green)')}
            ${barHtml(byConf.med, 'MED', 'var(--yellow)')}
            ${barHtml(byConf.low, 'LOW', 'var(--red)')}
          </div>
        </div>
      </div>
      <div class="trend-card" style="margin-top:8px">
        <h3>Last ${recentResults.length} Results</h3>
        <div class="recent-bars">${recentHtml}</div>
      </div>
      ` : `<div class="trend-card"><div class="trend-empty">Track record will appear after you have resolved picks.</div></div>`}
    </div>
  `;
}

// ---- SVG sparkline ----
function renderSparklineChart(points, baseline, label) {
  if (points.length < 2) return '';
  const w = 280, h = 80;
  const pad = { top: 6, right: 6, bottom: 14, left: 36 };
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;
  const vals = points.map(p => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = Math.max(max - min, 1);
  const xScale = iw / (vals.length - 1);
  const yScale = (v) => pad.top + ih - ((v - min) / range) * ih;
  const line = vals.map((v, i) => `${pad.left + i * xScale},${yScale(v)}`).join(' ');

  const isGreen = vals[vals.length - 1] >= baseline;
  const lastVal = vals[vals.length - 1];

  const ticks = [];
  const tickCount = 4;
  for (let i = 0; i < tickCount; i++) {
    const v = min + (range * i / (tickCount - 1));
    const y = yScale(v);
    ticks.push(`<text x="${pad.left - 4}" y="${y + 3}" text-anchor="end" class="chart-tick">${v.toFixed(0)}</text>`);
  }

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="sparkline-svg">
      <polyline points="${line}" fill="none" stroke="${isGreen ? 'var(--green)' : 'var(--red)'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${pad.left + (vals.length - 1) * xScale}" cy="${yScale(lastVal)}" r="2.5" fill="${isGreen ? 'var(--green)' : 'var(--red)'}"/>
      <line x1="${pad.left}" y1="${yScale(baseline)}" x2="${pad.left + iw}" y2="${yScale(baseline)}" stroke="var(--text-muted)" stroke-width="0.5" stroke-dasharray="3,2" opacity="0.5"/>
      ${ticks.join('')}
    </svg>
  `;
}

// ---- Streak dots ----
function renderScoreDots(lastTen) {
  if (!lastTen) return '';
  const parts = lastTen.split('-');
  const w = parseInt(parts[0]) || 0;
  const l = parseInt(parts[1]) || 0;
  let dots = '';
  for (let i = 0; i < w; i++) dots += '<span class="dot dot-w"></span>';
  for (let i = 0; i < l; i++) dots += '<span class="dot dot-l"></span>';
  return `<div class="streak-dots">${dots}</div>`;
}

// ---- Countdown render ----
function renderCountdown(game) {
  if (!game.game_date || game.status !== 'Scheduled' && game.status !== 'Preview') return '';
  const d = new Date(game.game_date);
  if (isNaN(d.getTime()) || d <= new Date()) return '';
  return `<div class="countdown"><span class="countdown-icon">⏱</span> <span data-countdown="${game.game_date}">--</span></div>`;
}

// ---- Render: game card ----
function renderGameCard(game) {
  const colHome = teamColor(game.home_team.abbreviation, currentSport);
  const colAway = teamColor(game.away_team.abbreviation, currentSport);

  const wpHome = game.home_implied_prob != null
    ? (game.home_implied_prob * 100).toFixed(0) : '50';
  const wpAway = (100 - parseInt(wpHome));

  const sourceBadge = game.odds_source === 'real'
    ? '<span class="source-badge source-real" title="Odds from sportsbook">LIVE</span>'
    : '<span class="source-badge source-calc" title="Calculated odds (no line found)">MODEL</span>';

  const hasScore = game.home_score != null && game.away_score != null;
  const statusDisplay = game.status === 'In Progress' && game.inning_state
    ? `● ${game.status} — ${game.inning_state}`
    : `● ${game.status}`;

  const resolvedPicks = gamePicks.filter(p => p.status && p.status !== 'pending');
  const resolvedBadge = resolvedPicks.length > 0
    ? `<span class="resolved-badge" title="${resolvedPicks.filter(p => p.status === 'won').length}W / ${resolvedPicks.filter(p => p.status === 'lost').length}L / ${resolvedPicks.filter(p => p.status === 'push').length}P">${resolvedPicks.filter(p => p.status === 'won').length}W–${resolvedPicks.filter(p => p.status === 'lost').length}L</span>`
    : '';
  const scoreRow = hasScore ? `
    <div class="score-row">
      <span class="score-team">${game.away_team.abbreviation}</span>
      <span class="score-value">${game.away_score}</span>
      <span class="score-divider">-</span>
      <span class="score-value">${game.home_score}</span>
      <span class="score-team">${game.home_team.abbreviation}</span>
    </div>
  ` : '';

  const countdownHtml = renderCountdown(game);
  const awayMove = renderLineMovement(game, 'away');
  const homeMove = renderLineMovement(game, 'home');

  const hasStats = currentSport === 'mlb' || (window.sportsConfig && window.sportsConfig[currentSport]?.has_stats);
  const oddsOnlyBadge = !hasStats ? '<span class="source-badge source-calc" title="Odds only — no team stats available">ODDS ONLY</span>' : '';

  const gamePicks = picksByGameId[game.id] || [];
  const pickIndicators = gamePicks.map(p => {
    const sideLabel = p.bet_type === 'moneyline'
      ? (p.side === 'home' ? game.home_team.abbreviation : game.away_team.abbreviation)
      : `${p.side.toUpperCase()}`;
    const pickColor = p.status === 'won' ? 'var(--green)' : p.status === 'lost' ? 'var(--red)' : confidenceColor(p.confidence);
    const statusIcon = p.status === 'won' ? '✓' : p.status === 'lost' ? '✗' : '';
    const inSlip = betslipPicks.some(b => `${b.game_id}_${b.bet_type}_${b.side}` === `${p.game_id}_${p.bet_type}_${p.side}`);
    return `
      <div class="game-pick-indicator ${inSlip ? 'in-slip' : ''}" style="border-left-color:${pickColor}"
           onclick="event.stopPropagation();toggleBetSlip(allPicks.find(x => x.game_id === '${p.game_id}' && x.bet_type === '${p.bet_type}' && x.side === '${p.side}'));showToast(TOAST_MSGS.${inSlip ? 'removeSlip' : 'addSlip'},'${inSlip ? 'info' : 'success'}')"
           title="${inSlip ? 'Remove from' : 'Add to'} bet slip">
        <span class="gpi-type">${p.bet_type === 'moneyline' ? 'ML' : 'O/U'}</span>
        <span class="gpi-side">${statusIcon} ${sideLabel}</span>
        <span class="gpi-conf">${(p.confidence * 100).toFixed(0)}%</span>
        <span class="gpi-edge">${p.edge}%</span>
        <span class="gpi-slip">${inSlip ? '✓' : '+'}</span>
      </div>
    `;
  }).join('');

  const analysis = analysisByGameId[game.id];
  const projectedRow = analysis ? `
    <div class="projected-row">
      <span>Proj: ${analysis.home_win_prob > 0.5 ? game.home_team.abbreviation : game.away_team.abbreviation} ${(Math.max(analysis.home_win_prob, analysis.away_win_prob) * 100).toFixed(0)}%</span>
      <span>Total: ${analysis.projected_total.toFixed(1)}</span>
    </div>
  ` : '';

  return `
    <div class="game-card" id="game-${game.id}" data-game-id="${game.id}" onclick="showGameDetail('${game.id}')">
      <div class="game-header" style="border-left: 4px solid ${colHome};border-right: 4px solid ${colAway};">
        <span>${game.venue || game.status}</span>
        <span class="game-header-right">
          ${countdownHtml}
          ${oddsOnlyBadge}
          ${game.venue_info && game.venue_info.label !== 'Unknown' ? `<span class="venue-badge" title="${game.venue_info.description}">${game.venue_info.label}</span>` : ''}
          ${sourceBadge}
          ${resolvedBadge}
          <span class="game-status status-${game.status.toLowerCase().replace(/\s+/g, '-')}">${statusDisplay}</span>
        </span>
      </div>

      ${scoreRow}

      <div class="team-row">
        <div class="team-info">
          <span class="team-color-dot" style="background:${colAway}"></span>
          <div>
            <div class="team-name">${game.away_team.abbreviation}</div>
            <div class="team-record">${game.away_team.wins}-${game.away_team.losses}</div>
            ${renderScoreDots(game.away_team.last_ten)}
            ${renderTrendText(game.away_team.last_ten)}
            ${game.away_pitcher ? `<div class="team-pitcher">${game.away_pitcher.name} (${game.away_pitcher.era.toFixed(2)} ERA)</div>` : ''}
          </div>
        </div>
        <div class="odds-badge ${moneylineClass(game.away_moneyline)}">
          ${formatMoneyline(game.away_moneyline)}${awayMove}
        </div>
      </div>

      <div class="team-row">
        <div class="team-info">
          <span class="team-color-dot" style="background:${colHome}"></span>
          <div>
            <div class="team-name">${game.home_team.abbreviation}</div>
            <div class="team-record">${game.home_team.wins}-${game.home_team.losses}</div>
            ${renderScoreDots(game.home_team.last_ten)}
            ${renderTrendText(game.home_team.last_ten)}
            ${game.home_pitcher ? `<div class="team-pitcher">${game.home_pitcher.name} (${game.home_pitcher.era.toFixed(2)} ERA)</div>` : ''}
          </div>
        </div>
        <div class="odds-badge ${moneylineClass(game.home_moneyline)}">
          ${formatMoneyline(game.home_moneyline)}${homeMove}
        </div>
      </div>

      ${game.over_under ? `
      <div class="ou-row">
        <span class="ou-label">Over / Under</span>
        <span class="ou-value">O/U ${game.over_under.toFixed(1)}</span>
      </div>
      ` : ''}

      ${projectedRow}

      <div class="win-prob-container">
        <span class="win-prob-label">${game.away_team.abbreviation} ${wpAway}%</span>
        <div class="win-prob-bar">
          <div class="win-prob-fill win-prob-away" style="width:${wpAway}%"></div>
          <div class="win-prob-fill win-prob-home" style="width:${wpHome}%"></div>
        </div>
        <span class="win-prob-label">${game.home_team.abbreviation} ${wpHome}%</span>
      </div>

      ${pickIndicators ? `<div class="game-picks-row">${pickIndicators}</div>` : ''}
    </div>
  `;
}

// ---- Render: full pick card ----
function renderFullPick(pick) {
  const confColor = confidenceColor(pick.confidence);
  const sideLabel = pick.bet_type === 'moneyline'
    ? (pick.side === 'home' ? pick.matchup.split(' @ ')[1] : pick.matchup.split(' @ ')[0])
    : `${pick.side.toUpperCase()} ${pick.line?.toFixed(1)}`;

  const isResolved = pick.status && pick.status !== 'pending';
  const statusBadge = isResolved
    ? `<span class="pick-status ${pick.status}">${pick.status.toUpperCase()} ${pick.units > 0 ? '+' : ''}${pick.units?.toFixed(2) ?? ''}u</span>`
    : '';

  const borderColor = isResolved
    ? (pick.status === 'won' ? 'var(--green)' : pick.status === 'push' ? 'var(--yellow)' : 'var(--red)')
    : 'transparent';

  const voidBtn = pick.status === 'pending' ? `<button class="void-btn" onclick="event.stopPropagation();voidPick('${pick.game_id}','${pick.bet_type}','${pick.side}')" title="Void pick">✕</button>` : '';
  const inSlip = betslipPicks.some(b => `${b.game_id}_${b.bet_type}_${b.side}` === `${pick.game_id}_${pick.bet_type}_${pick.side}`);

  return `
    <div class="pick-card" style="border-left: 3px solid ${borderColor}">
      <div class="pick-main">
        <span class="pick-type ${pick.bet_type}">
          ${pick.bet_type === 'moneyline' ? 'Moneyline' : 'Over/Under'}
          ${statusBadge}
        </span>
        <h3>${pick.matchup}</h3>
        <div class="pick-side" style="color:${confColor}">${sideLabel}</div>
        ${pick.odds ? `<div style="font-size:14px;color:var(--text-secondary);margin-top:4px">${formatMoneyline(pick.odds)}</div>` : ''}
        <div class="pick-reasoning">
          ${pick.reasoning.map(r => `<div class="pick-reason">${r}</div>`).join('')}
        </div>
        <button class="btn-betslip-add ${inSlip ? 'in-slip' : ''}" onclick="event.stopPropagation();toggleBetSlip(allPicks.find(x => x.game_id === '${pick.game_id}' && x.bet_type === '${pick.bet_type}' && x.side === '${pick.side}'));showToast(TOAST_MSGS.${inSlip ? 'removeSlip' : 'addSlip'},'${inSlip ? 'info' : 'success'}')">${inSlip ? '✓ In Slip' : '+ Bet Slip'}</button>
      </div>
      <div class="pick-metrics">
        ${voidBtn}
        <div class="pick-conf-text" style="color:${confColor}">${(pick.confidence * 100).toFixed(0)}%</div>
        <div class="pick-edge">Edge: <strong>${pick.edge}%</strong></div>
        ${pick.kelly_fraction != null && pick.kelly_fraction > 0 ? `<div class="pick-edge">Bet: <strong>${(pick.kelly_fraction * 100).toFixed(1)}%</strong></div>` : ''}
        ${pick.units != null ? `<div class="pick-edge">Units: <strong style="color:${pick.status === 'won' ? 'var(--green)' : pick.status === 'push' ? 'var(--yellow)' : 'var(--red)'}">${pick.units > 0 ? '+' : ''}${pick.units.toFixed(2)}</strong></div>` : ''}
      </div>
    </div>
  `;
}

// ---- Render: Record tab ----
function renderTracking(stats) {
  lastTrackingData = stats;
  const sidebar = $('tracking-stats');
  const pct = (stats.win_rate * 100).toFixed(1);
  sidebar.innerHTML = `
    <div class="tracking-summary">
      <div class="tracking-row">
        <span class="tracking-label">Record</span>
        <span class="tracking-value" style="color:var(--green)">${stats.won}W</span>
        <span class="tracking-sep">-</span>
        <span class="tracking-value" style="color:var(--red)">${stats.lost}L</span>
        ${stats.pushes > 0 ? `<span class="tracking-sep">-</span><span class="tracking-value" style="color:var(--yellow)">${stats.pushes}P</span>` : ''}
      </div>
      <div class="tracking-row">
        <span class="tracking-label">Win Rate</span>
        <span class="tracking-value">${pct}%</span>
      </div>
      <div class="tracking-row">
        <span class="tracking-label">Units</span>
        <span class="tracking-value profit" data-profit="${stats.total_units}">
          ${stats.total_units >= 0 ? '+' : ''}${stats.total_units.toFixed(2)}
        </span>
      </div>
      <div class="tracking-row">
        <span class="tracking-label">Bankroll</span>
        <span class="tracking-value profit" data-profit="${stats.total_units}">
          ${stats.current_bankroll.toFixed(2)}u <span style="font-size:11px;color:var(--text-secondary)">(${stats.roi >= 0 ? '+' : ''}${stats.roi}% ROI)</span>
        </span>
      </div>
      <div class="tracking-row">
        <span class="tracking-label">Pending</span>
        <span class="tracking-value" style="color:var(--yellow)">${stats.pending}</span>
      </div>
      ${stats.expired > 0 ? `<div class="tracking-row"><span class="tracking-label">Expired</span><span class="tracking-value" style="color:var(--text-muted)">${stats.expired}</span></div>` : ''}
    </div>
  `;

  const content = $('tracking-content');
  const allResolved = stats.picks.filter(p => p.status !== 'pending');
  const allPending = stats.picks.filter(p => p.status === 'pending');

  if (allResolved.length === 0 && allPending.length === 0) {
    content.innerHTML = `<div class="empty-state">${EMPTY_SVG('record')}<span class="empty-title">No results tracked yet</span><span class="empty-sub">Picks show up here once games finish. Patience, young grasshopper.</span></div>`;
    return;
  }

  // ---- Cumulative chart ----
  let chartHtml = '';
  if (allResolved.length > 0) {
    let cum = 0;
    const points = allResolved.slice().reverse().map(p => {
      cum += (p.units || 0);
      return cum;
    });
    const maxVal = Math.max(...points, 0);
    const minVal = Math.min(...points, 0);
    const range = Math.max(maxVal - minVal, 1);

    chartHtml = `
      <div class="chart-container">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:13px;color:var(--text-secondary);font-weight:600;">Cumulative Units</span>
          <span style="font-size:20px;font-weight:800;color:${stats.total_units >= 0 ? 'var(--green)' : 'var(--red)'}">
            ${stats.total_units >= 0 ? '+' : ''}${stats.total_units.toFixed(2)}u
          </span>
        </div>
        <div class="sparkline">
          ${points.map((v, i) => {
            const h = ((v - minVal) / range) * 100;
            const color = v >= 0 ? 'var(--green)' : 'var(--red)';
            return `<div class="spark-bar" style="height:${Math.max(h, 2)}%;background:${color}" title="${i+1}: ${v >= 0 ? '+' : ''}${v.toFixed(2)}u"></div>`;
          }).join('')}
        </div>
        <div class="chart-labels">
          <span>${minVal.toFixed(1)}</span>
          <span>${maxVal.toFixed(1)}</span>
        </div>
      </div>
    `;
  }

  // ---- Group picks by date ----
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function shortDateKey(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
  }

  const allPicks = [...allResolved, ...allPending];
  const byDate = {};
  allPicks.forEach(p => {
    const key = shortDateKey(p.tracked_at);
    if (!byDate[key]) byDate[key] = { label: formatDate(p.tracked_at), date: p.tracked_at, resolved: [], pending: [] };
    if (p.status !== 'pending') byDate[key].resolved.push(p);
    else byDate[key].pending.push(p);
  });

  const sortedDates = Object.keys(byDate).sort((a, b) => new Date(b) - new Date(a));

  const daySections = sortedDates.map(dateKey => {
    const day = byDate[dateKey];
    const w = day.resolved.filter(p => p.status === 'won').length;
    const l = day.resolved.filter(p => p.status === 'lost').length;
    const psh = day.resolved.filter(p => p.status === 'push').length;
    const dayUnits = day.resolved.reduce((s, p) => s + (p.units || 0), 0);
    const dayPct = w + l > 0 ? ((w / (w + l)) * 100).toFixed(0) : '--';

    const allDayPicks = [...day.resolved, ...day.pending].sort((a, b) => new Date(b.tracked_at) - new Date(a.tracked_at));

    const picksHtml = allDayPicks.map(p => {
      const isPending = p.status === 'pending';
      const isExpired = p.status === 'expired';
      const isWin = p.status === 'won';
      const isPush = p.status === 'push';
      const borderColor = isPending || isExpired ? 'var(--border)' : isWin ? 'var(--green)' : isPush ? 'var(--yellow)' : 'var(--red)';
      const resultText = isPending ? 'PENDING' : isExpired ? 'EXPIRED' : isWin ? 'WON' : isPush ? 'PUSH' : 'LOST';
      const resultClass = isPending ? '' : isExpired ? '' : isWin ? 'h2h-won' : isPush ? 'h2h-push' : 'h2h-lost';
      const sideLabel = p.bet_type === 'moneyline'
        ? (p.side === 'home' ? p.matchup.split(' @ ')[1] : p.matchup.split(' @ ')[0])
        : `${p.side.toUpperCase()} ${p.line?.toFixed(1)}`;
      return `
        <div class="day-pick" style="border-left:3px solid ${borderColor}" onclick="switchToGame('${p.game_id}')">
          <span class="day-pick-result ${resultClass}">${resultText}</span>
          <span class="day-pick-type">${p.bet_type === 'moneyline' ? 'ML' : 'O/U'}</span>
          <span class="day-pick-side">${sideLabel}</span>
          <span class="day-pick-odds">${formatMoneyline(p.odds)}</span>
          <span class="day-pick-units" style="color:${isPending || isExpired ? 'var(--text-muted)' : isWin ? 'var(--green)' : isPush ? 'var(--yellow)' : 'var(--red)'}">${isPending ? '--' : isExpired ? '—' : `${p.units > 0 ? '+' : ''}${p.units.toFixed(2)}u`}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="day-section">
        <div class="day-header">
          <span class="day-label">${day.label}</span>
          <span class="day-stats">
            ${w + l > 0 ? `<span class="day-record"><span class="day-w">${w}W</span> <span class="day-l">${l}L</span>${psh > 0 ? ` <span class="day-p">${psh}P</span>` : ''} <span class="day-pct">${dayPct}%</span></span>` : ''}
            ${day.pending.length > 0 ? `<span class="day-pending-count">${day.pending.length} pending</span>` : ''}
            ${dayUnits !== 0 ? `<span class="day-units" style="color:${dayUnits >= 0 ? 'var(--green)' : 'var(--red)'}">${dayUnits >= 0 ? '+' : ''}${dayUnits.toFixed(2)}u</span>` : ''}
          </span>
        </div>
        <div class="day-picks">${picksHtml}</div>
      </div>
    `;
  }).join('');

  content.innerHTML = `
    ${chartHtml}
    <div class="day-list">${daySections}</div>
    <div style="margin-top:12px;text-align:right">
      <button class="btn-primary" style="padding:8px 12px;font-size:12px" onclick="downloadCSV(allResolved)">Export CSV</button>
    </div>
  `;
}

function downloadCSV(allResolved) {
  const headers = ['Game ID', 'Matchup', 'Type', 'Side', 'Odds', 'Line', 'Confidence', 'Edge', 'Result', 'Units', 'Tracked At'];
  const rows = allResolved.map(p => [
    p.game_id, p.matchup, p.bet_type, p.side, p.odds, p.line, p.confidence, p.edge, p.status, p.units, p.tracked_at
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bet_history.csv';
  a.click();
}

// ---- Rules modal ----
function toggleRules() {
  $('rules-modal').classList.toggle('visible');
}
function closeRules(e) {
  if (!e || e.target.id === 'rules-modal') $('rules-modal').classList.remove('visible');
}

// ---- Game Detail modal ----
function showGameDetail(gameId) {
  const game = allGames.find(g => g.id === gameId);
  const analysis = analysisByGameId[gameId];
  if (!game) return;
  const picks = picksByGameId[gameId] || [];
  $('detail-matchup').textContent = `${game.away_team.name} @ ${game.home_team.name}`;
  $('detail-venue').textContent = game.venue;
  const awayMove = renderLineMovement(game, 'away');
  const homeMove = renderLineMovement(game, 'home');
  const colAway = teamColor(game.away_team.abbreviation);
  const colHome = teamColor(game.home_team.abbreviation);

  let bodyHtml = `
    <div class="detail-teams">
      <div class="detail-team" style="border-left:3px solid ${colAway}">
        <div class="detail-team-name">${game.away_team.name} (${game.away_team.abbreviation})</div>
        <div class="detail-team-record">${game.away_team.wins}-${game.away_team.losses} · ${(game.away_team.win_pct * 100).toFixed(1)}%</div>
        ${renderScoreDots(game.away_team.last_ten)}
        ${game.away_pitcher ? `<div class="detail-pitcher">SP: ${game.away_pitcher.name} · ${game.away_pitcher.era.toFixed(2)} ERA · ${game.away_pitcher.strikeouts} K</div>` : ''}
        <div class="detail-odds">Odds: <span class="${moneylineClass(game.away_moneyline)}">${formatMoneyline(game.away_moneyline)}</span>${awayMove} · Implied: ${game.away_implied_prob ? (game.away_implied_prob * 100).toFixed(0) + '%' : '—'}</div>
      </div>
      <div class="detail-vs">@</div>
      <div class="detail-team" style="border-left:3px solid ${colHome}">
        <div class="detail-team-name">${game.home_team.name} (${game.home_team.abbreviation})</div>
        <div class="detail-team-record">${game.home_team.wins}-${game.home_team.losses} · ${(game.home_team.win_pct * 100).toFixed(1)}%</div>
        ${renderScoreDots(game.home_team.last_ten)}
        ${game.home_pitcher ? `<div class="detail-pitcher">SP: ${game.home_pitcher.name} · ${game.home_pitcher.era.toFixed(2)} ERA · ${game.home_pitcher.strikeouts} K</div>` : ''}
        <div class="detail-odds">Odds: <span class="${moneylineClass(game.home_moneyline)}">${formatMoneyline(game.home_moneyline)}</span>${homeMove} · Implied: ${game.home_implied_prob ? (game.home_implied_prob * 100).toFixed(0) + '%' : '—'}</div>
      </div>
    </div>
    ${game.over_under ? `<div class="detail-ou">Over/Under: <strong>${game.over_under.toFixed(1)}</strong></div>` : ''}
  `;

  if (analysis) {
    bodyHtml += `
      <div class="detail-section">
        <h3>Model Analysis</h3>
        ${!hasStats ? '<div class="odds-only-notice">⚠ Odds-only — no live team stats available for this sport. Analysis is based on implied probabilities.</div>' : ''}
        <div class="detail-analysis-grid">
          <div class="detail-analysis-item">
            <span class="detail-analysis-label">Win Probability</span>
            <span class="detail-analysis-value">${game.away_team.abbreviation} ${(analysis.away_win_prob * 100).toFixed(0)}% · ${game.home_team.abbreviation} ${(analysis.home_win_prob * 100).toFixed(0)}%</span>
          </div>
          <div class="detail-analysis-item">
            <span class="detail-analysis-label">Projected Total</span>
            <span class="detail-analysis-value">${analysis.projected_total.toFixed(1)} runs</span>
          </div>
          <div class="detail-analysis-item">
            <span class="detail-analysis-label">Over Chance</span>
            <span class="detail-analysis-value">${(analysis.over_prob * 100).toFixed(0)}%</span>
          </div>
          <div class="detail-analysis-item">
            <span class="detail-analysis-label">Under Chance</span>
            <span class="detail-analysis-value">${(analysis.under_prob * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    `;
  }

  if (picks.length > 0) {
    bodyHtml += `<div class="detail-section"><h3>Picks</h3>`;
    picks.forEach(p => {
      const confColor = confidenceColor(p.confidence);
      const sideLabel = p.bet_type === 'moneyline'
        ? (p.side === 'home' ? game.home_team.name : game.away_team.name)
        : `${p.side.toUpperCase()} ${p.line?.toFixed(1)}`;
      const isResolved = p.status && p.status !== 'pending';
      const statusBadge = isResolved
        ? `<span class="pick-status ${p.status}">${p.status.toUpperCase()} ${p.units > 0 ? '+' : ''}${p.units?.toFixed(2) ?? ''}u</span>`
        : '';
      bodyHtml += `
        <div class="detail-pick-card" style="border-left:3px solid ${confColor}">
          <div class="detail-pick-header">
            <span class="pick-type ${p.bet_type}">${p.bet_type === 'moneyline' ? 'Moneyline' : 'Over/Under'} ${statusBadge}</span>
            <span class="detail-pick-edge">Edge: ${p.edge}% · Conf: ${(p.confidence * 100).toFixed(0)}%</span>
          </div>
          <div class="detail-pick-side" style="color:${confColor}">${sideLabel} @ ${formatMoneyline(p.odds)}</div>
          <div class="pick-reasoning">
            ${p.reasoning.map(r => `<div class="pick-reason">${r}</div>`).join('')}
          </div>
        </div>
      `;
    });
    bodyHtml += `</div>`;
  }

  bodyHtml += `<div class="detail-section"><h3>Trends</h3><div class="detail-trends">
    <div class="detail-team-trend" style="border-left:3px solid ${colAway}">
      <div class="detail-team-name">${game.away_team.name}</div>
      <div class="detail-trend-row">Last 10: ${renderScoreDots(game.away_team.last_ten)} ${renderTrendText(game.away_team.last_ten)}</div>
      <div class="detail-trend-row">Record: ${game.away_team.wins}-${game.away_team.losses}</div>
      ${analysis ? `<div class="detail-trend-row">Model Win Prob: ${(analysis.away_win_prob * 100).toFixed(0)}%</div>` : ''}
    </div>
    <div class="detail-team-trend" style="border-left:3px solid ${colHome}">
      <div class="detail-team-name">${game.home_team.name}</div>
      <div class="detail-trend-row">Last 10: ${renderScoreDots(game.home_team.last_ten)} ${renderTrendText(game.home_team.last_ten)}</div>
      <div class="detail-trend-row">Record: ${game.home_team.wins}-${game.home_team.losses}</div>
      ${analysis ? `<div class="detail-trend-row">Model Win Prob: ${(analysis.home_win_prob * 100).toFixed(0)}%</div>` : ''}
    </div>
    ${game.over_under && analysis ? `<div class="detail-ou-trend">
      <div class="detail-trend-row">Projected Total: ${analysis.projected_total.toFixed(1)} vs Line ${game.over_under.toFixed(1)}</div>
      <div class="detail-trend-row">Over ${(analysis.over_prob * 100).toFixed(0)}% · Under ${(analysis.under_prob * 100).toFixed(0)}%</div>
    </div>` : ''}
  </div></div>`;

  bodyHtml += `<div class="detail-section"><h3>Game Info</h3><div class="detail-info-grid">
    <div><span class="detail-analysis-label">Status</span><span class="detail-analysis-value">${game.status}</span></div>
    <div><span class="detail-analysis-label">Odds Source</span><span class="detail-analysis-value">${game.odds_source === 'real' ? 'Live sportsbook' : 'Model calculated'}</span></div>
    ${game.inning_state ? `<div><span class="detail-analysis-label">Inning</span><span class="detail-analysis-value">${game.inning_state}</span></div>` : ''}
    ${game.game_date ? `<div><span class="detail-analysis-label">Start</span><span class="detail-analysis-value">${new Date(game.game_date).toLocaleString()}</span></div>` : ''}
  </div></div>`;

  if (game.venue_info) {
    const vi = game.venue_info;
    const colorClass = vi.park_factor > 1.02 ? 'hitter-friendly' : vi.park_factor < 0.98 ? 'pitcher-friendly' : '';
    bodyHtml += `<div class="detail-section"><h3>Ballpark: ${vi.name}</h3><div class="detail-venue-info ${colorClass}">
      <div class="venue-fact">${vi.description}</div>
      <div class="venue-stats">
        <span>Park Factor: <strong>${vi.park_factor.toFixed(2)}</strong></span>
        <span>Home Run Factor: <strong>${vi.home_run_factor}</strong></span>
        <span>Overs Hit Rate: <strong>${vi.overs_rate}</strong></span>
      </div>
    </div></div>`;
  }

  $('detail-body').innerHTML = bodyHtml;
  $('game-detail-modal').classList.add('visible');
}

function closeGameDetail(e) {
  if (!e || e.target.id === 'game-detail-modal') $('game-detail-modal').classList.remove('visible');
}

// ---- Render: activity feed ----
function renderActivity(trackingData) {
  const feed = $('activity-feed');
  if (!feed) return;
  const recent = (trackingData?.picks || [])
    .filter(p => p.status !== 'pending')
    .sort((a, b) => new Date(b.tracked_at) - new Date(a.tracked_at))
    .slice(0, 10);
  if (recent.length === 0) {
    feed.innerHTML = `<div class="activity-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
      <span>No activity yet</span>
    </div>`;
    return;
  }
  feed.innerHTML = recent.map(p => {
    const isWin = p.status === 'won';
    const isPush = p.status === 'push';
    const icon = isWin ? '✓' : isPush ? '=' : '✗';
    const clr = isWin ? 'var(--green)' : isPush ? 'var(--yellow)' : 'var(--red)';
    const time = new Date(p.tracked_at);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sideLabel = p.bet_type === 'moneyline'
      ? (p.side === 'home' ? p.matchup.split(' @ ')[1] : p.matchup.split(' @ ')[0])
      : `${p.side.toUpperCase()} ${p.line?.toFixed(1)}`;
    return `<div class="activity-item">
      <span class="activity-icon" style="color:${clr}">${icon}</span>
      <div class="activity-body">
        <div class="activity-matchup">${p.matchup}</div>
        <div class="activity-detail">${p.bet_type === 'moneyline' ? 'ML' : 'O/U'} · ${sideLabel} · ${formatMoneyline(p.odds)}</div>
      </div>
      <div class="activity-right">
        <span class="activity-units" style="color:${clr}">${p.units > 0 ? '+' : ''}${p.units?.toFixed(2)}u</span>
        <span class="activity-time">${timeStr}</span>
      </div>
    </div>`;
  }).join('');
}

// ---- Header ----
function updateHeaderStats(trackingData) {
  const el = $('header-record');
  if (trackingData && trackingData.total > 0) {
    const pct = (trackingData.win_rate * 100).toFixed(1);
    el.textContent = `${trackingData.won}W-${trackingData.lost}L (${pct}%)`;
    el.style.color = trackingData.win_rate >= 0.5 ? 'var(--green)' : 'var(--red)';
  } else {
    el.textContent = 'No bets';
    el.style.color = 'var(--text-secondary)';
  }
  const roiEl = $('header-roi');
  if (trackingData) {
    const roi = trackingData.roi || 0;
    roiEl.textContent = `${roi >= 0 ? '+' : ''}${roi}%`;
    roiEl.style.color = roi >= 0 ? 'var(--green)' : 'var(--red)';
  } else {
    roiEl.textContent = '--';
  }
  const modelEl = $('header-model-version');
  if (modelEl && allAnalysisResults.length > 0) {
    modelEl.textContent = allAnalysisResults[0]?.model_version || 'v1';
  }
  $('last-updated').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  updateStreak(trackingData);
}

function updateStreak(trackingData) {
  const el = $('streak-msg');
  if (!el) return;
  if (!trackingData || trackingData.total === 0) { el.textContent = ''; return; }
  const last5 = (trackingData.picks || []).filter(p => p.status !== 'pending').slice(-5);
  const wins = last5.filter(p => p.status === 'won').length;
  const streak = wins > 2 ? '🔥 On fire' : wins > 1 ? '👍 Finding a groove' : trackingData.win_rate >= 0.5 ? '📈 Profitable' : '🧊 Rough patch';
  el.textContent = streak;
  el.style.color = wins > 2 ? 'var(--green)' : wins > 1 ? 'var(--yellow)' : 'var(--text-secondary)';
}

// ---- Footer tip ----
function updateFooterTip(oddsUsage) {
  const el = $('footer-tip');
  if (!el) return;
  let tip = '💡 ' + pickRandom(FOOTER_TIPS);
  if (oddsUsage && oddsUsage.pct > 80) {
    tip = `⚠️ Odds API: ${oddsUsage.monthly_requests}/${oddsUsage.limit} used this month. Consider reducing refresh rate.`;
  } else if (oddsUsage && oddsUsage.pct > 50) {
    tip += ` | API: ${oddsUsage.monthly_requests}/${oddsUsage.limit} used`;
  }
  el.textContent = tip;
}

// ---- Search filter ----
function filterGamesBySearch() {
  const q = searchValue.toLowerCase().trim();
  const gameFilter = $('game-filter')?.value;
  let games = allGames;
  if (q) {
    games = games.filter(g =>
      g.home_team.name.toLowerCase().includes(q) ||
      g.away_team.name.toLowerCase().includes(q) ||
      g.home_team.abbreviation.toLowerCase().includes(q) ||
      g.away_team.abbreviation.toLowerCase().includes(q) ||
      g.venue.toLowerCase().includes(q)
    );
  }
  if (gameFilter && gameFilter !== 'all') {
    games = games.filter(g => g.id === gameFilter);
  }
  return games;
}

// ---- Render views ----
function renderGames() {
  const grid = $('games-grid');
  const filtered = filterGamesBySearch();
  if (filtered.length === 0) {
    grid.innerHTML = searchValue
      ? `<div class="empty-state">${EMPTY_SVG('games')}<span class="empty-title">No "${searchValue}"</span><span class="empty-sub">Try something else. That team might be made up.</span></div>`
      : `<div class="empty-state">${EMPTY_SVG('games')}<span class="empty-title">No games today</span><span class="empty-sub">Go outside. Touch grass. We'll be here tomorrow.</span></div>`;
    return;
  }
  grid.innerHTML = filtered.map(g => renderGameCard(g)).join('');
  startCountdowns();
}

function renderTopPicks() {
  const list = $('top-picks-list');
  const sorted = [...allPicks].sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  if (sorted.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:16px">${EMPTY_SVG('picks')}<span class="empty-title">No picks yet</span><span class="empty-sub">Model's still thinking. It's not fast. It's profound.</span></div>`;
    return;
  }
  list.innerHTML = sorted.map(p => renderMiniPick(p)).join('');
}

function renderAllPicks() {
  const list = $('picks-list');
  const betType = $('bet-type-filter').value;
  const minConf = parseFloat($('confidence-filter').value);
  const sortBy = $('sort-filter').value;
  const showUnresolved = $('show-unresolved').checked;
  const gameFilter = $('game-filter').value;

  let filtered = [...allPicks];
  if (betType !== 'all') filtered = filtered.filter(p => p.bet_type === betType);
  filtered = filtered.filter(p => p.confidence >= minConf);
  if (!showUnresolved) filtered = filtered.filter(p => p.status === 'won' || p.status === 'lost');
  if (gameFilter !== 'all') filtered = filtered.filter(p => p.game_id === gameFilter);

  if (sortBy === 'confidence') {
    filtered.sort((a, b) => b.confidence - a.confidence);
  } else {
    filtered.sort((a, b) => b.edge - a.edge);
  }

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">${EMPTY_SVG('picks')}<span class="empty-title">No picks match</span><span class="empty-sub">Try loosening those filters. The model tries its best.</span></div>`;
    return;
  }
  list.innerHTML = filtered.map(p => renderFullPick(p)).join('');
}

// ---- Tab switching ----
function switchToTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (tab) tab.classList.add('active');
  const view = $(`${tabName}-view`);
  if (view) view.classList.add('active');
  history.replaceState(null, '', `#${tabName}`);
  if (tabName === 'picks' && allPicks.length === 0) {
    $('picks-list').innerHTML = '<div class="loading">Loading picks...</div>';
  }
  if (tabName === 'tracking' && (!lastTrackingData || lastTrackingData.picks.length === 0)) {
    $('tracking-content').innerHTML = '<div class="loading">Loading record...</div>';
  }
}

function switchToGame(gameId) {
  switchToTab('games');
  const el = $(`game-${gameId}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => showGameDetail(gameId), 300);
  } else {
    showGameDetail(gameId);
  }
}

function switchToPicksForGame(gameId) {
  const sel = $('game-filter');
  if (sel) sel.value = gameId;
  renderGames();
  switchToTab('picks');
  renderAllPicks();
}

function voidPick(gameId, betType, side) {
  const pick = allPicks.find(p => p.game_id === gameId && p.bet_type === betType && p.side === side);
  const label = pick ? `${pick.matchup} — ${betType === 'moneyline' ? 'ML' : 'O/U'} ${side.toUpperCase()}` : `${gameId}`;
  if (!confirm(`Void "${label}"? This cannot be undone.`)) return;
  fetch(`${API_BASE}/api/tracker/void`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, bet_type: betType, side: side }),
  }).then(r => {
    if (!r.ok) throw new Error(`Server returned ${r.status}`);
    return r.json();
  }).then(() => {
    loadAllData();
    showToast(TOAST_MSGS.void, 'success');
  }).catch(err => {
    showToast(`Failed to void: ${err.message}`, 'error');
  });
}

function toggleBetSlipPanel() {
  const content = $('betslip-content');
  const toggle = $('betslip-toggle');
  const collapsed = content.classList.contains('collapsed');
  content.classList.toggle('collapsed');
  toggle.textContent = collapsed ? '−' : '+';
}

// ---- Track previous odds for line movement ----
function trackOdds() {
  allGames.forEach(g => {
    if (g.home_moneyline) previousOdds[`${g.id}_home`] = g.home_moneyline;
    if (g.away_moneyline) previousOdds[`${g.id}_away`] = g.away_moneyline;
  });
}

// ---- Load all data ----
async function loadAllData() {
  const refreshBtn = $('refresh-btn');
  if (refreshBtn) refreshBtn.textContent = pickRandom(LOADING_MSGS);
  savedScrollY = window.scrollY;
  setRefreshing(true);

  try {
    const [analysisData, trackingData, healthData, historyData, configData] = await Promise.all([
      fetchAPI('/api/analysis/all'),
      fetchAPI('/api/tracker/stats'),
      fetchAPI('/api/health'),
      fetchAPI('/api/tracker/history'),
      fetchAPI('/api/tracker/config'),
    ]);

    allAnalysisResults = analysisData;
    allGames = analysisData.map(r => r.game);
    allPicks = analysisData.flatMap(r => r.recommendations);

    picksByGameId = {};
    analysisByGameId = {};
    analysisData.forEach(r => {
      analysisByGameId[r.game.id] = r;
      r.recommendations.forEach(p => {
        if (!picksByGameId[p.game_id]) picksByGameId[p.game_id] = [];
        picksByGameId[p.game_id].push(p);
      });
    });

    trackOdds();
    lastSuccessfulRefresh = Date.now();

    populateGameFilter();
    renderGames();
    renderTopPicks();
    renderAllPicks();
    renderTracking(trackingData);
    updateHeaderStats(trackingData);
    renderBetSlip();
    renderActivity(trackingData);
    renderPickTrends();
    renderTrends(trackingData);
    renderPnlChart(historyData || []);
    renderConfigForm(configData || {});
    checkSettledPicks(trackingData);
    updateFooterTip(healthData?.odds_api_usage);

    if (savedScrollY > 0) {
      requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
    }

    if (!isAutoRefresh) {
      showToast(TOAST_MSGS.refresh, 'success');
    }
    refreshFailures = 0;
  } catch (err) {
    console.error('Failed to load data:', err);
    refreshFailures++;
    if (lastSuccessfulRefresh) {
      showToast(`Refresh failed: ${err.message}`, 'error');
    } else {
      $('games-grid').innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          ${EMPTY_SVG('games')}
          <span class="empty-title">Failed to load data</span>
          <span class="empty-sub">${err.message}</span>
          <button class="btn-primary" style="width:auto;display:inline-block;padding:8px 24px;margin-top:12px" onclick="loadAllData()">Retry</button>
        </div>
      `;
      $('top-picks-list').innerHTML = `<div class="empty-state" style="padding:16px">${EMPTY_SVG('picks')}<span class="empty-title">Connection error</span></div>`;
      $('tracking-stats').innerHTML = `<div class="empty-state" style="padding:12px">${EMPTY_SVG('record')}<span class="empty-title">Connection error</span></div>`;
    }
  } finally {
    if (refreshBtn) refreshBtn.textContent = '⟳ Refresh Data';
    setRefreshing(false);
  }
}

// ---- Notifications ----
let previousPickStatuses = {};
let notifPermission = 'default';

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('sw.js');
  } catch (e) {
    // silently fail — SW not critical
  }
}

function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(p => { notifPermission = p; });
  } else {
    notifPermission = Notification.permission;
  }
}

function checkSettledPicks(trackingData) {
  if (notifPermission !== 'granted') return;
  if (!trackingData || !trackingData.picks) return;
  const changed = [];
  const nowStatuses = {};
  for (const p of trackingData.picks) {
    const key = `${p.game_id}_${p.bet_type}_${p.side}`;
    const prevStatus = previousPickStatuses[key];
    nowStatuses[key] = p.status;
    if (prevStatus === 'pending' && p.status !== 'pending' && p.status !== 'expired') {
      changed.push(p);
    }
  }
  previousPickStatuses = nowStatuses;
  for (const p of changed) {
    const emoji = p.status === 'won' ? '✅' : p.status === 'lost' ? '❌' : '➖';
    const units = p.units != null ? (p.units >= 0 ? `+${p.units}` : `${p.units}`) : '';
    try {
      new Notification(`${emoji} ${p.matchup}`, {
        body: `${p.bet_type === 'moneyline' ? 'ML' : 'O/U'} ${p.side.toUpperCase()} — ${p.status.toUpperCase()} ${units}`,
      });
    } catch (e) {
      // ignore
    }
  }
}

// ---- P&L Chart (sparkline) ----
function renderPnlChart(history) {
  const canvas = document.getElementById('pnl-chart');
  if (!canvas || history.length < 2) {
    if (canvas) canvas.style.display = 'none';
    return;
  }
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;

  const values = history.map(d => d.cumulative);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;

  ctx.clearRect(0, 0, w, h);

  // Grid line at 0
  if (min < 0 && max > 0) {
    const y0 = h - ((0 - min) / range) * (h - pad * 2) - pad;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(w, y0);
    ctx.stroke();
  }

  // Line
  ctx.strokeStyle = '#e8b341';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  history.forEach((d, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - ((d.cumulative - min) / range) * (h - pad * 2) - pad;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Fill below line
  const lastX = w;
  const lastY = h - ((values[values.length - 1] - min) / range) * (h - pad * 2) - pad;
  const firstX = 0;
  const firstY = h - ((values[0] - min) / range) * (h - pad * 2) - pad;
  const bottomY = h - pad;
  ctx.lineTo(lastX, bottomY);
  ctx.lineTo(firstX, bottomY);
  ctx.closePath();
  ctx.fillStyle = 'rgba(232, 179, 65, 0.08)';
  ctx.fill();

  // Dot on last value
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fillStyle = values[values.length - 1] >= 0 ? '#e8b341' : '#e74c3c';
  ctx.fill();
}

// ---- Config / Bankroll ----
function openConfig() {
  const modal = document.getElementById('config-modal');
  if (modal) modal.classList.add('active');
}

function closeConfig(e) {
  if (e && e.target !== e.currentTarget) return;
  const modal = document.getElementById('config-modal');
  if (modal) modal.classList.remove('active');
}

async function saveConfig() {
  const bankroll = parseFloat(document.getElementById('config-bankroll')?.value);
  const unitSize = parseFloat(document.getElementById('config-unit-size')?.value);
  if (isNaN(bankroll) || bankroll <= 0) { showToast('Bankroll must be positive', 'error'); return; }
  if (isNaN(unitSize) || unitSize <= 0) { showToast('Unit size must be positive', 'error'); return; }
  try {
    await fetchAPI('/api/tracker/config', {
      method: 'POST',
      body: JSON.stringify({ bankroll, unit_size: unitSize }),
      headers: { 'Content-Type': 'application/json' },
    });
    showToast('Settings saved', 'success');
    closeConfig();
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  }
}

function exportCSV() {
  window.open('/api/tracker/export', '_blank');
}

function renderConfigForm(config) {
  const bEl = document.getElementById('config-bankroll');
  const uEl = document.getElementById('config-unit-size');
  if (bEl) bEl.value = config.bankroll ?? 100;
  if (uEl) uEl.value = config.unit_size ?? 1;
}

function changeRefreshInterval() {
  const sel = document.getElementById('refresh-interval');
  if (!sel) return;
  currentRefreshInterval = parseInt(sel.value);
  localStorage.setItem('refreshInterval', currentRefreshInterval.toString());
  isAutoRefresh = false;
  loadAllData();
}

// ---- Setup ----
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
  });
}

function setupFilters() {
  $('bet-type-filter').addEventListener('change', renderAllPicks);
  $('sort-filter').addEventListener('change', renderAllPicks);
  $('show-unresolved').addEventListener('change', renderAllPicks);
  $('game-filter').addEventListener('change', () => {
    renderGames();
    renderAllPicks();
  });

  const searchInput = $('team-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchValue = searchInput.value;
      renderGames();
    });
  }

  const confSlider = $('confidence-filter');
  confSlider.addEventListener('input', () => {
    $('confidence-value').textContent = `${(parseFloat(confSlider.value) * 100).toFixed(0)}%`;
    renderAllPicks();
  });

  $('refresh-btn').addEventListener('click', () => {
    isAutoRefresh = false;
    loadAllData();
  });
}

function startAutoRefresh() {
  registerSW();
  document.addEventListener('click', requestNotifPermission, { once: true });

  const sel = $('sport-selector');
  if (sel) sel.value = currentSport;

  const ri = document.getElementById('refresh-interval');
  if (ri) ri.value = currentRefreshInterval.toString();

  const hashTab = location.hash.replace('#', '');
  if (hashTab && ['games', 'picks', 'tracking'].includes(hashTab)) {
    switchToTab(hashTab);
  }
  isAutoRefresh = true;
  loadAllData();
  scheduleRefresh();
  setInterval(updateStaleWarning, 30000); // check stale warning every 30s
}

function scheduleRefresh() {
  if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
  if (currentRefreshInterval === 0) return;
  const backoff = Math.min(refreshFailures, 5);
  const interval = currentRefreshInterval * Math.pow(2, backoff);
  autoRefreshTimer = setTimeout(() => {
    isAutoRefresh = true;
    loadAllData();
    scheduleRefresh();
  }, interval);
}

function changeSport() {
  const sel = $('sport-selector');
  if (!sel) return;
  currentSport = sel.value;
  localStorage.setItem('selectedSport', currentSport);
  isAutoRefresh = false;
  loadAllData();
}

fetchAPI('/api/sports').then(data => {
  window.sportsConfig = Object.fromEntries((data || []).map(s => [s.key, s]));
}).catch(() => { window.sportsConfig = {}; });

setupTabs();
setupFilters();
startAutoRefresh();
