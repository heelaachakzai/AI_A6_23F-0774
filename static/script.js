
const CFG = { rows: 4, cols: 4, pits: 3 };
const MIN = { rows: 3, cols: 3, pits: 1 };
const MAX = { rows: 8, cols: 8, pits: 14 };

let state = null;
let timer = null;
let speed = 700;
let peakInf = 1;

function adj(k, d) {
  CFG[k] = Math.min(MAX[k], Math.max(MIN[k], CFG[k] + d));
  document.getElementById('v-' + k).textContent = CFG[k];
}

async function startGame() {
  const btn = document.querySelector('.btn-start');
  btn.textContent = 'Starting…';
  await newGame();
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  btn.innerHTML = '<span class="btn-start-icon">▶</span> Initialize Agent';
}

function goReset() {
  stopAuto();
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('game').classList.add('hidden');
  document.getElementById('intro').classList.remove('hidden');
  state = null;
}

async function newGame() {
  const r = await fetch('/api/new_game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CFG)
  });
  state = await r.json();
  peakInf = 1;
  render();
}

async function doStep() {
  if (!state || state.dead || state.won) return;
  const r = await fetch('/api/step', { method: 'POST' });
  state = await r.json();
  if (state.inference_steps > peakInf) peakInf = state.inference_steps;
  render();
  if (state.dead || state.won) { stopAuto(); setTimeout(showOverlay, 500); }
}

function toggleAuto() {
  const btn = document.getElementById('btn-auto');
  if (timer) {
    stopAuto();
  } else {
    btn.classList.add('on');
    btn.textContent = 'Stop ⏹';
    timer = setInterval(doStep, speed);
  }
}
function stopAuto() {
  clearInterval(timer); timer = null;
  const btn = document.getElementById('btn-auto');
  btn.classList.remove('on');
  btn.textContent = 'Auto ⏩';
}
function setSpeed(v) {
  speed = +v;
  document.getElementById('speed-val').textContent = v + 'ms';
  if (timer) { stopAuto(); toggleAuto(); }
}


function render() {
  renderNav();
  renderGrid();
  renderPercepts();
  renderLists();
  renderMetrics();
}

function renderNav() {
  tick('n-infer', state.inference_steps);
  tick('n-moves', state.step_count);
  tick('n-visit', state.visited.length);
  tick('n-safe',  state.safe_confirmed.length);
}
function tick(id, val) {
  const el = document.getElementById(id);
  if (+el.textContent === val) return;
  el.textContent = val;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 400);
}

function renderGrid() {
  const { grid, rows, cols } = state;
  const g = document.getElementById('grid');
  g.style.gridTemplateColumns = `repeat(${cols}, 76px)`;

  const cellCount = rows * cols;
  while (g.children.length < cellCount) g.appendChild(makeCell());
  while (g.children.length > cellCount) g.removeChild(g.lastChild);

  let idx = 0;
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      fillCell(g.children[idx++], grid[r][c]);
    }
  }

  renderAxisLabels(rows, cols);
}

function makeCell() {
  const d = document.createElement('div');
  d.className = 'cell';
  d.innerHTML = '<span class="c-coord"></span><span class="c-icon"></span><span class="c-label"></span>';
  return d;
}

function fillCell(el, cell) {
  const cls = cellState(cell);
  if (!el.dataset.state || el.dataset.state !== cls) {
    el.className = 'cell ' + cls;
    el.dataset.state = cls;
  }
  el.querySelector('.c-coord').textContent = `${cell.r},${cell.c}`;
  el.querySelector('.c-icon').textContent  = cellIcon(cell);
  el.querySelector('.c-label').textContent = cellLabel(cell);
}

function cellState(cell) {
  const reveal = state.dead || state.won;
  if (cell.agent)        return 'st-agent';
  if (cell.show_pit)     return 'st-pit';
  if (cell.show_wumpus)  return 'st-wumpus';
  if (cell.gold && (cell.visited || reveal)) return 'st-gold';
  if (cell.safe)         return 'st-safe';
  return 'st-unknown';
}
function cellIcon(cell) {
  const reveal = state.dead || state.won;
  if (cell.agent)        return '🤖';
  if (cell.show_pit)     return '🕳️';
  if (cell.show_wumpus)  return '👾';
  if (cell.gold && (cell.visited || reveal)) return '🪙';
  if (cell.safe)         return '✅';
  return '❓';
}
function cellLabel(cell) {
  const reveal = state.dead || state.won;
  if (cell.agent)        return 'AGENT';
  if (cell.show_pit)     return 'PIT';
  if (cell.show_wumpus)  return 'WUMPUS';
  if (cell.gold && (cell.visited || reveal)) return 'GOLD';
  if (cell.safe)         return 'SAFE';
  return '???';
}

function renderAxisLabels(rows, cols) {
  const CELL = 76, GAP = 5;
  const total = CELL + GAP;
  const labelW = 28;

  const colEl = document.getElementById('col-labels');
  colEl.innerHTML = '';
  colEl.style.display = 'flex';
  for (let c = 0; c < cols; c++) {
    const s = document.createElement('span');
    s.className = 'gl-item';
    s.style.width = total + 'px';
    s.textContent = c;
    colEl.appendChild(s);
  }

  const rowEl = document.getElementById('row-labels');
  rowEl.innerHTML = '';
  for (let r = rows - 1; r >= 0; r--) {
    const s = document.createElement('span');
    s.className = 'gl-item';
    s.style.height = total + 'px';
    s.style.width = labelW + 'px';
    s.textContent = r;
    rowEl.appendChild(s);
  }
}

function renderPercepts() {
  const el = document.getElementById('percepts');
  const p  = state.percepts || [];
  if (!p.length) {
    el.innerHTML = '<span class="none-label">No percepts detected</span>';
    return;
  }
  const map = {
    Breeze:  ['🌬️', 'ptag-breeze',  'Breeze'],
    Stench:  ['💀', 'ptag-stench',  'Stench'],
    Glitter: ['✨', 'ptag-glitter', 'Glitter'],
  };
  el.innerHTML = p.map(x => {
    const [ic, cls, lbl] = map[x] || ['·', '', x];
    return `<span class="ptag ${cls}">${ic} ${lbl}</span>`;
  }).join('');
}

function renderLists() {
  const facts = state.kb_facts || [];
  const log   = state.log || [];

  document.getElementById('kb-badge').textContent = facts.length;
  fillList('kb-list', facts, 20);
  fillList('agent-list', log,  12);

  const cnf = facts.filter(f => f.includes('⇒') || f.includes('¬') || f.includes('TELL'));
  fillList('cnf-list', cnf.slice(-14), 14);
}

function fillList(id, items, max) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  const slice = items.slice(-max).reverse();
  slice.forEach((txt, i) => {
    const li = document.createElement('li');
    li.textContent = txt;
    if (i === 0) li.classList.add('hi');
    if (txt.includes('safe') || txt.includes('SAFE') || txt.includes('¬P') || txt.includes('¬W')) li.classList.add('safe');
    if (txt.includes('dead') || txt.includes('pit') || txt.includes('PIT') || txt.includes('Pit')) li.classList.add('warn');
    el.appendChild(li);
  });
}

function renderMetrics() {
  const s = state;
  const total = s.rows * s.cols;
  const explPct = Math.round((s.visited.length / total) * 100);

  document.getElementById('m-infer').textContent   = s.inference_steps;
  document.getElementById('m-explore').textContent = explPct + '%';
  document.getElementById('m-safe').textContent    = s.safe_confirmed.length;

  setBar('mb-infer',   s.inference_steps,      Math.max(peakInf, 20));
  setBar('mb-explore', explPct,                 100);
  setBar('mb-safe',    s.safe_confirmed.length, Math.max(total, 1));

  document.getElementById('n-infer').textContent = s.inference_steps;
  document.getElementById('n-moves').textContent = s.step_count;
  document.getElementById('n-visit').textContent = s.visited.length;
  document.getElementById('n-safe').textContent  = s.safe_confirmed.length;
}

function setBar(id, val, max) {
  document.getElementById(id).style.width = Math.min(100, Math.round(val / max * 100)) + '%';
}

function showOverlay() {
  const s = state;
  const win = s.won;
  const total = s.rows * s.cols;

  document.getElementById('ov-emoji').textContent = win ? '🏆' : '☠️';
  document.getElementById('ov-title').textContent = win ? 'Gold Secured!' : 'Agent Eliminated';
  document.getElementById('ov-sub').textContent   = win
    ? 'The logic agent successfully navigated the cave and retrieved the gold.'
    : 'The agent stepped into a fatal hazard. Better luck next episode.';

  const og = document.getElementById('ov-grid');
  og.innerHTML = [
    [s.inference_steps, 'Inferences'],
    [s.step_count,      'Moves'],
    [s.visited.length,  'Explored'],
    [s.safe_confirmed.length, 'Safe cells'],
  ].map(([n, l]) => `
    <div class="ov-stat">
      <div class="ov-stat-n">${n}</div>
      <div class="ov-stat-l">${l}</div>
    </div>`).join('');

  const box = document.getElementById('ov-box');
  box.className = 'ov-box ' + (win ? 'win' : 'lose');
  document.getElementById('overlay').classList.remove('hidden');
}
