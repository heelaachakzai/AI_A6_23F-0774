/* ── State ────────────────────────────────────────────────── */
let gameState = null;
let autoTimer = null;

/* ── DOM refs ─────────────────────────────────────────────── */
const gridEl      = document.getElementById('grid-container');
const btnNew      = document.getElementById('btn-new');
const btnStep     = document.getElementById('btn-step');
const btnAuto     = document.getElementById('btn-auto');
const banner      = document.getElementById('status-banner');
const mSteps      = document.getElementById('m-steps');
const mMoves      = document.getElementById('m-moves');
const mVisited    = document.getElementById('m-visited');
const mSafe       = document.getElementById('m-safe');
const perceptEl   = document.getElementById('percept-badges');
const kbEl        = document.getElementById('kb-facts');
const logEl       = document.getElementById('agent-log');

/* ── Event listeners ─────────────────────────────────────── */
btnNew.addEventListener('click', newGame);
btnStep.addEventListener('click', step);
btnAuto.addEventListener('click', toggleAuto);

/* ── API helpers ─────────────────────────────────────────── */
async function newGame() {
  stopAuto();
  const rows = +document.getElementById('inp-rows').value;
  const cols = +document.getElementById('inp-cols').value;
  const pits = +document.getElementById('inp-pits').value;

  const res  = await fetch('/api/new_game', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({rows, cols, pits})
  });
  gameState = await res.json();
  btnStep.disabled = false;
  btnAuto.disabled = false;
  btnAuto.textContent = '⏩ Auto';
  render();
}

async function step() {
  if (!gameState || gameState.dead || gameState.won) return;
  const res  = await fetch('/api/step', { method:'POST' });
  gameState  = await res.json();
  render();
  if (gameState.dead || gameState.won) stopAuto();
}

/* ── Auto play ───────────────────────────────────────────── */
function toggleAuto() {
  if (autoTimer) {
    stopAuto();
  } else {
    btnAuto.textContent = '⏹ Stop';
    autoTimer = setInterval(async () => {
      await step();
      if (gameState.dead || gameState.won) stopAuto();
    }, 600);
  }
}

function stopAuto() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  btnAuto.textContent = '⏩ Auto';
}

/* ── Render ──────────────────────────────────────────────── */
function render() {
  if (!gameState) return;
  renderGrid();
  renderMetrics();
  renderPercepts();
  renderLogs();
  renderBanner();
}

function renderGrid() {
  const { grid, rows, cols } = gameState;
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  gridEl.innerHTML = '';

  for (let r = rows - 1; r >= 0; r--) {      // render top row = highest row index
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      const div  = document.createElement('div');
      div.className = 'cell ' + cellClass(cell);

      // coordinate label
      const coord = document.createElement('span');
      coord.className = 'coord';
      coord.textContent = `(${r},${c})`;
      div.appendChild(coord);

      // icon
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = cellIcon(cell);
      div.appendChild(icon);

      // sub-label
      const lbl = document.createElement('span');
      lbl.className = 'label';
      lbl.textContent = cellLabel(cell);
      div.appendChild(lbl);

      gridEl.appendChild(div);
    }
  }
}

function cellClass(cell) {
  if (cell.agent)       return 'agent';
  if (cell.show_pit)    return 'pit';
  if (cell.show_wumpus) return 'wumpus-cell';
  if (cell.gold && (cell.visited || gameState.won)) return 'gold-cell';
  if (cell.safe)        return 'safe';
  return 'unknown';
}

function cellIcon(cell) {
  if (cell.agent)       return '🤖';
  if (cell.show_pit)    return '🕳️';
  if (cell.show_wumpus) return '👾';
  if (cell.gold && (cell.visited || gameState.won)) return '🪙';
  if (cell.safe)        return '✅';
  return '❓';
}

function cellLabel(cell) {
  if (cell.agent)       return 'AGENT';
  if (cell.show_pit)    return 'PIT';
  if (cell.show_wumpus) return 'WUMPUS';
  if (cell.gold && (cell.visited || gameState.won)) return 'GOLD';
  if (cell.safe)        return 'SAFE';
  return '???';
}

/* ── Metrics ─────────────────────────────────────────────── */
function renderMetrics() {
  mSteps.textContent   = gameState.inference_steps;
  mMoves.textContent   = gameState.step_count;
  mVisited.textContent = gameState.visited.length;
  mSafe.textContent    = gameState.safe_confirmed.length;
}

function renderPercepts() {
  const p = gameState.percepts;
  if (!p || p.length === 0) {
    perceptEl.innerHTML = '<span class="badge badge-none">None</span>';
    return;
  }
  perceptEl.innerHTML = p.map(x => {
    const cls = {Breeze:'badge-breeze', Stench:'badge-stench', Glitter:'badge-glitter'}[x] || '';
    return `<span class="badge ${cls}">${x}</span>`;
  }).join(' ');
}

/* ── Logs ─────────────────────────────────────────────────── */
function renderLogs() {
  renderList(kbEl, gameState.kb_facts,  true);
  renderList(logEl, gameState.log,      true);
}

function renderList(el, items, highlight) {
  el.innerHTML = '';
  if (!items) return;
  [...items].reverse().forEach((txt, i) => {
    const li = document.createElement('li');
    li.textContent = txt;
    if (highlight && i === 0) li.classList.add('highlight');
    el.appendChild(li);
  });
}

/* ── Banner ─────────────────────────────────────────────────*/
function renderBanner() {
  if (gameState.won) {
    banner.textContent = '🏆 GOLD FOUND — VICTORY!';
    banner.className = 'status-banner win';
  } else if (gameState.dead) {
    banner.textContent = '💀 AGENT DEAD';
    banner.className = 'status-banner lose';
  } else {
    banner.className = 'status-banner hidden';
  }
}