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
