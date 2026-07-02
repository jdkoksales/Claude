/* Mijn Coach — client logic (vanilla JS, no dependencies) */

const $ = (id) => document.getElementById(id);
let S = null; // latest state snapshot from the server
let token = localStorage.getItem('coach_token') || '';

/* ─── API helper ────────────────────────────────────────── */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401 && path !== '/api/login') {
    showLogin();
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fout (${res.status})`);
  return data;
}

/* ─── Markdown-lite (safe) ──────────────────────────────── */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}
function md(src) {
  const lines = esc(src).split(/\r?\n/);
  const out = [];
  let list = null;
  const inline = (t) =>
    t
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  const flushList = () => { if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) { (list ??= []).push(`<li>${inline(m[1])}</li>`); continue; }
    flushList();
    if (!line) continue;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    out.push(`<p>${h ? `<strong>${inline(h[1])}</strong>` : inline(line)}</p>`);
  }
  flushList();
  return out.join('');
}

/* ─── Formatting helpers ────────────────────────────────── */
const fmtNum = (n) => Number(n).toLocaleString('nl-NL', { maximumFractionDigits: 1 });
function relTime(ts) {
  const d = new Date(String(ts).replace(' ', 'T'));
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'zojuist';
  if (mins < 60) return `${mins} min geleden`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} uur geleden`;
  const days = Math.round(h / 24);
  if (days === 1) return 'gisteren';
  if (days < 7) return `${days} dagen geleden`;
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

/* ─── Login (PIN pad) ───────────────────────────────────── */
let pin = '';
function renderPin() {
  $('pinDots').innerHTML = Array.from({ length: Math.max(4, pin.length) })
    .map((_, i) => `<span class="${i < pin.length ? 'filled' : ''}"></span>`)
    .join('');
  $('keyOk').disabled = pin.length < 4;
}
async function submitPin() {
  if (pin.length < 4) return;
  try {
    const { token: t } = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    token = t;
    localStorage.setItem('coach_token', t);
    pin = '';
    $('pinError').textContent = '';
    await boot();
  } catch (err) {
    $('pinError').textContent = err.message;
    pin = '';
    renderPin();
  }
}
$('keypad').addEventListener('click', (e) => {
  const k = e.target.closest('button')?.dataset.k;
  if (!k) return;
  if (k === 'back') pin = pin.slice(0, -1);
  else if (k === 'ok') return submitPin();
  else if (pin.length < 6) pin += k;
  renderPin();
});
document.addEventListener('keydown', (e) => {
  if ($('login').classList.contains('hidden')) return;
  if (/^\d$/.test(e.key) && pin.length < 6) { pin += e.key; renderPin(); }
  else if (e.key === 'Backspace') { pin = pin.slice(0, -1); renderPin(); }
  else if (e.key === 'Enter') submitPin();
});
function showLogin() {
  token = '';
  localStorage.removeItem('coach_token');
  $('app').classList.add('hidden');
  $('login').classList.remove('hidden');
  renderPin();
}

/* ─── Rendering ─────────────────────────────────────────── */
function renderHeader() {
  const h = new Date().getHours();
  const part = h < 6 ? 'Goedenacht' : h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
  $('greeting').textContent = `${part}${S.userName ? ', ' + esc(S.userName) : ''}! 👋`;
  $('today').textContent = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function renderStats() {
  const open = S.tasks.open.length;
  const done = S.tasks.doneToday.length;
  const best = Math.max(0, ...S.goals.map((g) => g.streak));
  $('stats').innerHTML = `
    <div class="stat"><div class="label">Open taken</div><div class="value">${open}</div></div>
    <div class="stat"><div class="label">Vandaag afgerond</div><div class="value">${done} ${done > 0 ? '✅' : ''}</div></div>
    <div class="stat"><div class="label">Beste streak</div><div class="value">${best > 0 ? `${best} ${best === 1 ? 'dag' : 'dagen'} 🔥` : '—'}</div></div>`;
}

/* Line chart per goal — single series, 2px line, 10% area wash, end dot + ring */
function sparkSVG(goal) {
  const pts = goal.series.points;
  if (pts.length < 2) return '';
  const W = 560, H = 72, padX = 6, padY = 12, padR = 56;
  const xs = pts.map((p) => new Date(p.day).getTime());
  const ys = pts.map((p) => p.value);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const X = (t) => padX + ((t - x0) / (x1 - x0)) * (W - padX - padR);
  const Y = (v) => H - padY - ((v - y0) / (y1 - y0)) * (H - 2 * padY);
  const coords = pts.map((p, i) => [X(xs[i]), Y(ys[i])]);
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords.at(-1)[0].toFixed(1)},${H - 2} L${coords[0][0].toFixed(1)},${H - 2} Z`;
  const [ex, ey] = coords.at(-1);
  // The end label is HTML (not SVG text) so it stays crisp when the chart
  // stretches on narrow screens.
  const endLabel = goal.series.mode === 'value'
    ? `${fmtNum(ys.at(-1))}${goal.unit ? ' ' + esc(goal.unit) : ''}`
    : `${ys.at(-1)}×`;
  return `
  <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" data-goal="${goal.id}">
    <line x1="0" y1="${H - 2}" x2="${W}" y2="${H - 2}" stroke="var(--hairline)" stroke-width="1"/>
    <path d="${area}" fill="var(--series-wash)"/>
    <path d="${line}" fill="none" stroke="var(--series)" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle class="hoverdot" r="5" fill="var(--series)" stroke="var(--surface)" stroke-width="2" opacity="0"/>
    <circle cx="${ex}" cy="${ey}" r="4.5" fill="var(--series)" stroke="var(--surface)" stroke-width="2"/>
  </svg>
  <span class="spark-label" style="top:${((ey / H) * 100).toFixed(1)}%">${endLabel}</span>`;
}

function attachSparkHover(container, goal) {
  const svg = container.querySelector('svg');
  const tip = document.createElement('div');
  tip.className = 'tip hidden';
  container.appendChild(tip);
  const pts = goal.series.points;
  svg.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const xs = pts.map((p) => new Date(p.day).getTime());
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const t = x0 + frac * (x1 - x0);
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - t) < Math.abs(xs[best] - t)) best = i;
    const p = pts[best];
    const W = 560, H = 72, padX = 6, padY = 12, padR = 56;
    let y0 = Math.min(...pts.map((q) => q.value)), y1 = Math.max(...pts.map((q) => q.value));
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    const cx = (padX + ((xs[best] - x0) / (x1 - x0)) * (W - padX - padR)) / W * rect.width;
    const cy = (H - padY - ((p.value - y0) / (y1 - y0)) * (H - 2 * padY)) / H * rect.height;
    const dot = svg.querySelector('.hoverdot');
    dot.setAttribute('cx', (cx / rect.width) * W);
    dot.setAttribute('cy', (cy / rect.height) * H);
    dot.setAttribute('opacity', '1');
    const when = new Date(p.day).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    tip.textContent = `${when}: ${fmtNum(p.value)}${goal.series.mode === 'value' && goal.unit ? ' ' + goal.unit : goal.series.mode === 'count' ? '×' : ''}`;
    tip.style.left = `${cx}px`;
    tip.style.top = `${cy}px`;
    tip.classList.remove('hidden');
  });
  svg.addEventListener('pointerleave', () => {
    tip.classList.add('hidden');
    svg.querySelector('.hoverdot').setAttribute('opacity', '0');
  });
}

function renderGoals() {
  const wrap = $('goalList');
  $('goalCount').textContent = S.goals.length ? `· ${S.goals.length}` : '';
  if (!S.goals.length) {
    wrap.innerHTML = `<div class="empty">Nog geen doelen. Vertel je coach in de chat wat je wilt bereiken — bijvoorbeeld: <em>“mijn doel is 3x per week sporten”</em>.</div>`;
    return;
  }
  wrap.innerHTML = '';
  for (const g of S.goals) {
    const el = document.createElement('div');
    el.className = 'goal';
    const chips = [];
    if (g.streak > 1) chips.push(`<span class="chip streak">🔥 ${g.streak} dagen</span>`);
    if (g.target_date) chips.push(`<span class="chip">📅 ${esc(g.target_date)}</span>`);
    const meter = g.pct != null
      ? `<div class="meter">
           <div class="meter-track"><div class="meter-fill" style="width:${g.pct}%"></div></div>
           <div class="meter-label">
             <span>${fmtNum(g.latest)}${g.unit ? ' ' + esc(g.unit) : ''} van ${fmtNum(g.target_value)}${g.unit ? ' ' + esc(g.unit) : ''}</span>
             <span>${g.pct}%</span>
           </div>
         </div>`
      : '';
    const note = g.recent[0]
      ? `<div class="goal-note">Laatst: ${esc(g.recent[0].note)} · ${relTime(g.recent[0].created_at)}</div>`
      : '';
    el.innerHTML = `
      <div class="goal-head"><span class="goal-title">${esc(g.title)}</span>${chips.join('')}</div>
      ${meter}
      <div class="spark">${sparkSVG(g)}</div>
      ${note}`;
    wrap.appendChild(el);
    if (g.series.points.length >= 2) attachSparkHover(el.querySelector('.spark'), g);
  }
}

function taskRow(t, done) {
  return `<li class="${done ? 'done-task' : ''}">
    <button class="checkbox ${done ? 'done' : ''}" data-task="${t.id}" aria-label="Afvinken">✓</button>
    <span class="task-title">${esc(t.title)}</span>
    ${t.due ? `<span class="chip">📅 ${esc(t.due)}</span>` : ''}
  </li>`;
}
function renderTasks() {
  const open = S.tasks.open, done = S.tasks.doneToday;
  $('taskCount').textContent = open.length ? `· ${open.length} open` : '';
  $('taskList').innerHTML = open.length
    ? open.map((t) => taskRow(t, false)).join('')
    : `<div class="empty">Geen open taken — lekker bezig! 🎉</div>`;
  $('doneWrap').classList.toggle('hidden', done.length === 0);
  $('doneSummary').textContent = `Vandaag afgerond (${done.length})`;
  $('doneList').innerHTML = done.map((t) => taskRow(t, true)).join('');
}

const KINDS = {
  morning: '🌅 Ochtend-check-in',
  evening: '🌙 Avond-review',
  weekly: '📊 Weekreview',
  note: '📝 Notitie',
};
function renderFeed() {
  const wrap = $('feedList');
  if (!S.feed.length) {
    wrap.innerHTML = `<div class="empty">Hier verschijnen de check-ins van je coach (ochtend, avond en wekelijks). Probeer 'm meteen met <strong>▶ Nu een check-in</strong>.</div>`;
    return;
  }
  wrap.innerHTML = S.feed
    .map(
      (j) => `<div class="feed-item">
        <div class="feed-head">
          <span class="kind">${KINDS[j.kind] || '📝 ' + esc(j.kind)}</span>
          <span class="when">${relTime(j.created_at)}</span>
        </div>
        <div class="feed-body">${md(j.content)}</div>
      </div>`,
    )
    .join('');
}

function renderChat(scroll = true) {
  const wrap = $('chatScroll');
  const msgs = S.chat;
  wrap.innerHTML = msgs.length
    ? msgs
        .map((m) => `<div class="msg ${m.role === 'user' ? 'user' : 'coach'}">${md(m.content)}</div>`)
        .join('')
    : `<div class="empty">Zeg hoi tegen je coach! 👋 Vertel wat je bezighoudt, zet iets op je takenlijst, of stel een doel.</div>`;
  if (scroll) wrap.scrollTop = wrap.scrollHeight;
}

function renderAll() {
  renderHeader();
  renderStats();
  renderGoals();
  renderTasks();
  renderFeed();
  renderChat();
}

/* ─── Actions ───────────────────────────────────────────── */
$('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('taskInput').value.trim();
  if (!title) return;
  $('taskInput').value = '';
  try {
    const { state } = await api('/api/tasks', { method: 'POST', body: JSON.stringify({ title }) });
    S = state;
    renderStats(); renderTasks();
  } catch (err) { alert(err.message); }
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-task]');
  if (!btn) return;
  try {
    const { state } = await api(`/api/tasks/${btn.dataset.task}/toggle`, { method: 'POST' });
    S = state;
    renderStats(); renderTasks();
  } catch (err) { alert(err.message); }
});

let sending = false;
async function sendChat() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text || sending) return;
  sending = true;
  $('chatSend').disabled = true;
  input.value = '';
  input.style.height = 'auto';
  S.chat.push({ role: 'user', content: text });
  renderChat();
  const wrap = $('chatScroll');
  const typing = document.createElement('div');
  typing.className = 'msg coach typing';
  typing.innerHTML = '<i></i><i></i><i></i>';
  wrap.appendChild(typing);
  wrap.scrollTop = wrap.scrollHeight;
  try {
    const { state } = await api('/api/chat', { method: 'POST', body: JSON.stringify({ message: text }) });
    S = state;
    renderAll();
  } catch (err) {
    typing.remove();
    const errEl = document.createElement('div');
    errEl.className = 'msg coach';
    errEl.innerHTML = `<p>⚠️ ${esc(err.message)}</p>`;
    wrap.appendChild(errEl);
    wrap.scrollTop = wrap.scrollHeight;
  } finally {
    sending = false;
    $('chatSend').disabled = false;
    input.focus();
  }
}
$('chatForm').addEventListener('submit', (e) => { e.preventDefault(); sendChat(); });
$('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});
$('chatInput').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 130) + 'px';
});

$('checkinBtn').addEventListener('click', async () => {
  const btn = $('checkinBtn');
  btn.disabled = true;
  btn.textContent = 'Even denken…';
  try {
    const kind = new Date().getHours() >= 18 ? 'evening' : 'morning';
    const { state } = await api(`/api/checkin/${kind}`, { method: 'POST' });
    S = state;
    renderFeed();
  } catch (err) { alert(err.message); }
  btn.disabled = false;
  btn.textContent = '▶ Nu een check-in';
});

/* ─── Push notifications ────────────────────────────────── */
function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
async function setupNotifBanner() {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported || Notification.permission === 'denied') return;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (Notification.permission === 'granted' && existing) return;
  $('notifBanner').classList.remove('hidden');
  $('notifBtn').onclick = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return $('notifBanner').classList.add('hidden');
      const { key } = await api('/api/push/key');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(key),
      });
      await api('/api/push/subscribe', { method: 'POST', body: JSON.stringify(sub) });
      $('notifBanner').classList.add('hidden');
    } catch (err) {
      alert('Meldingen aanzetten lukte niet: ' + err.message);
    }
  };
}

/* ─── Mobile tabs ───────────────────────────────────────── */
$('tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('active', b === btn));
  const tab = btn.dataset.tab;
  const taskCard = $('taskForm').closest('.card');
  $('stats').classList.toggle('tab-hidden', tab !== 'dash');
  $('goalsCard').classList.toggle('tab-hidden', tab !== 'dash');
  taskCard.classList.toggle('tab-hidden', tab !== 'dash');
  $('feedCard').classList.toggle('tab-hidden', tab !== 'feed');
  $('colChat').classList.toggle('tab-hidden', tab !== 'chat');
  if (tab === 'chat') renderChat();
});
function initTabs() {
  if (window.matchMedia('(max-width: 900px)').matches) {
    $('feedCard').classList.add('tab-hidden');
    $('colChat').classList.add('tab-hidden');
  }
}

/* ─── Boot ──────────────────────────────────────────────── */
async function refresh() {
  try {
    S = await api('/api/state');
    renderAll();
  } catch { /* login shown by api() on 401 */ }
}
async function boot() {
  try {
    S = await api('/api/state');
  } catch {
    return; // not logged in → login screen is visible
  }
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  initTabs();
  renderAll();
  setupNotifBanner();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
setInterval(() => { if (document.visibilityState === 'visible' && token && S) refresh(); }, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && token && S) refresh();
});

if (token) boot(); else showLogin();
