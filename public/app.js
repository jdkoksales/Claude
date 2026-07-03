/* Mijn Coach — dagflow-client (vanilla JS, geen dependencies) */

const $ = (id) => document.getElementById(id);
let S = null; // laatste state van de server
let token = localStorage.getItem('coach_token') || '';
let editingGoalId = null;
let showNewForm = false;

/* ─── Helpers ───────────────────────────────────────────── */
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
    throw new Error('Niet ingelogd.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fout (${res.status})`);
  return data;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

let toastTimer = null;
function toast(msg) {
  document.getElementById('toast')?.remove();
  const el = document.createElement('div');
  el.id = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3500);
}

/* ─── Login (pinpad) ────────────────────────────────────── */
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
    const { token: t } = await api('/api/login', { method: 'POST', body: JSON.stringify({ pin }) });
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

/* ─── Renderers ─────────────────────────────────────────── */
function renderHeader() {
  const h = new Date().getHours();
  const part = h < 6 ? 'Goedenacht' : h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
  $('greeting').textContent = `${part}${S.userName ? ', ' + S.userName : ''}!`;
  $('todayLabel').textContent = S.today.label;
  const o = S.overall;
  $('overallStats').textContent =
    `${o.daysActive} ${o.daysActive === 1 ? 'dag' : 'dagen'} actief · ${o.comebacks} comeback${o.comebacks === 1 ? '' : 's'}`;
}

function sentenceFor(g) {
  if (g.anchor && g.place) {
    return `<span class="part">Na</span> ${esc(g.anchor)} <span class="part">doe ik</span> ${esc(g.action)} <span class="part">op/in</span> ${esc(g.place)}`;
  }
  return esc(g.action);
}

function logRow(g, dayName, level) {
  const btn = (lv, label) =>
    `<button type="button" data-goal="${g.id}" data-day="${dayName}" data-level="${lv}"
       class="${level === lv ? 'sel-' + lv : ''}">${label}</button>`;
  return `<div class="log-btns">
    ${btn('minimum', '✓ Minimum')}
    ${btn('target', '✓✓ Target')}
    ${btn('skip', 'Vandaag niet')}
  </div>`;
}

function renderToday() {
  const wrap = $('todayGoals');
  if (!S.goals.length) {
    wrap.innerHTML = `<div class="empty">Nog geen actief doel. Maak er hieronder één aan — <strong>één doel werkt het best</strong>.</div>`;
    $('yesterdayToggle').classList.add('hidden');
    $('yesterdayGoals').classList.add('hidden');
    return;
  }
  wrap.innerHTML = S.goals
    .map(
      (g) => `<div class="day-goal">
        <div class="sentence">${sentenceFor(g)}</div>
        ${g.stake ? `<div class="stake">⚠️ Inzet: ${esc(g.stake)}</div>` : ''}
        ${logRow(g, 'today', g.todayLevel)}
        <div class="min-desc">Minimum: ${esc(g.minimum)} · Target: ${esc(g.target)}</div>
      </div>`,
    )
    .join('');

  const yWrap = $('yesterdayGoals');
  const toggle = $('yesterdayToggle');
  toggle.classList.remove('hidden');
  toggle.textContent = yWrap.classList.contains('hidden')
    ? `Gisteren (${S.yesterday.label}) vergeten te loggen? →`
    : 'Verberg gisteren';
  yWrap.innerHTML = `<div class="yesterday-block"><h3>Gisteren — ${esc(S.yesterday.label)}</h3>${S.goals
    .map(
      (g) => `<div class="day-goal">
        <div class="sentence">${sentenceFor(g)}</div>
        ${logRow(g, 'yesterday', g.yesterdayLevel)}
      </div>`,
    )
    .join('')}</div>`;
}

function heatmapHTML(g) {
  const pad = Array.from({ length: g.heatmap.firstWeekday })
    .map(() => '<span></span>')
    .join('');
  const cells = g.heatmap.days
    .map((d) => {
      const cls = ['cell', d.level || '', d.isToday ? 'today' : '', d.future ? 'future' : '']
        .filter(Boolean)
        .join(' ');
      return `<span class="${cls}" title="${d.day}"></span>`;
    })
    .join('');
  return `<div class="heatmap">
    <div class="grid">${pad}${cells}</div>
    <div class="legend">
      <span class="l-min"><i></i>minimum</span>
      <span class="l-tgt"><i></i>target</span>
      <span><i></i>leeg</span>
    </div>
  </div>`;
}

function goalFormHTML(g = null) {
  const v = (x) => esc(x ?? '');
  return `<form class="goal-form" data-goal="${g ? g.id : ''}">
    <label>Na… <span class="hint-inline">(bestaande gewoonte)</span></label>
    <input name="anchor" value="${v(g?.anchor)}" placeholder="bv. mijn ochtendkoffie" maxlength="200" />
    <label>…doe ik… (actie)</label>
    <input name="action" value="${v(g?.action)}" placeholder="bv. 10 minuten lezen" maxlength="200" />
    <label>…op/in (plek)</label>
    <input name="place" value="${v(g?.place)}" placeholder="bv. de bank in de woonkamer" maxlength="200" />
    <label>Minimum — max 2 minuten, onmogelijk te falen</label>
    <input name="minimum" value="${v(g?.minimum)}" placeholder="bv. 1 bladzijde lezen" maxlength="200" />
    <label>Target — de volledige versie</label>
    <input name="target" value="${v(g?.target)}" placeholder="bv. 20 minuten lezen" maxlength="200" />
    <label>Inzet / consequentie (optioneel)</label>
    <input name="stake" value="${v(g?.stake)}" placeholder="bv. €5 in de pot bij een skip-week" maxlength="200" />
    <p class="form-error"></p>
    <div class="form-actions">
      <button type="submit" class="btn-primary">${g ? 'Opslaan' : 'Doel aanmaken'}</button>
      <button type="button" class="btn-soft form-cancel">Annuleren</button>
      ${g ? `<button type="button" class="btn-soft" data-pause="${g.id}">⏸ Pauzeer 1 week</button>
             <button type="button" class="btn-soft" data-archive="${g.id}">🗄 Archiveer</button>` : ''}
    </div>
  </form>`;
}

function renderGoals() {
  $('goalCount').textContent = `· ${S.activeCount} van max 3`;
  const wrap = $('goalDetails');
  if (!S.goals.length) {
    wrap.innerHTML = '';
  } else {
    wrap.innerHTML = S.goals
      .map((g) => {
        if (editingGoalId === g.id) {
          return `<div class="goal-detail">${goalFormHTML(g)}</div>`;
        }
        return `<div class="goal-detail">
          <div class="head">
            <span class="name">${esc(g.action)}</span>
            <span class="nums">${g.daysActive} ${g.daysActive === 1 ? 'dag' : 'dagen'} actief · ${g.comebacks} comeback${g.comebacks === 1 ? '' : 's'}</span>
            <button class="edit-btn" data-edit="${g.id}" title="Bewerken" aria-label="Bewerk doel">✎</button>
          </div>
          ${heatmapHTML(g)}
        </div>`;
      })
      .join('');
  }

  $('pausedList').innerHTML = S.pausedGoals
    .map(
      (p) => `<div class="paused-row">⏸ <span class="name">${esc(p.action)}</span>
        <span>(gepauzeerd tot ${esc(p.paused_until || 'nader order')})</span>
        <button class="btn-soft" data-resume="${p.id}">Hervat</button>
      </div>`,
    )
    .join('');

  const nw = $('newGoalWrap');
  if (showNewForm) {
    nw.innerHTML = goalFormHTML(null);
  } else if (S.activeCount < 3) {
    nw.innerHTML = `<div class="form-actions" style="margin-top:12px">
      <button class="btn-soft" id="newGoalBtn" type="button">＋ Nieuw doel</button>
      ${S.activeCount >= 1 ? '<span class="hint" style="margin:0;align-self:center">Tip: één doel tegelijk werkt het best.</span>' : ''}
    </div>`;
  } else {
    nw.innerHTML = `<p class="hint">Maximum bereikt (3 actieve doelen). Archiveer of pauzeer er eerst één.</p>`;
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
  const open = S.tasks.open;
  const done = S.tasks.doneToday;
  $('taskCount').textContent = open.length ? `· ${open.length} open` : '';
  $('taskList').innerHTML = open.length
    ? open.map((t) => taskRow(t, false)).join('')
    : `<div class="empty">Geen open taken.</div>`;
  $('doneWrap').classList.toggle('hidden', done.length === 0);
  $('doneSummary').textContent = `Vandaag afgerond (${done.length})`;
  $('doneList').innerHTML = done.map((t) => taskRow(t, true)).join('');
}

function renderReview() {
  const card = $('reviewCard');
  if (!S.review.due) {
    card.classList.add('hidden');
    return;
  }
  card.className = 'card review-card';
  card.innerHTML = `
    <h2>📋 Weekreview <span class="count">— 4 vragen, max 3 minuten</span></h2>
    <form id="reviewForm">
      <label>1. Wat ging deze week makkelijker dan verwacht?</label>
      <textarea name="makkelijker" rows="1" maxlength="500"></textarea>
      <label>2. Wat was het zwaarste moment — en wat gebeurde er vlak daarvoor?</label>
      <textarea name="zwaarste" rows="1" maxlength="500"></textarea>
      <label>3. Hoe voelde je minimum?</label>
      <select name="minimum_gevoel">
        <option value="goed">precies goed</option>
        <option value="te licht">te licht</option>
        <option value="te zwaar">te zwaar</option>
      </select>
      <label>4. Wat wordt volgende week anders?</label>
      <textarea name="anders" rows="1" maxlength="500"></textarea>
      <div class="review-actions">
        <button type="submit" class="btn-primary">Opslaan</button>
        <button type="button" class="btn-soft" id="reviewSkip">Deze week overslaan</button>
      </div>
    </form>`;
  card.querySelector('#reviewForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await act('/api/review', { answers: Object.fromEntries(fd.entries()), skipped: false });
    toast('Weekreview opgeslagen. 🧡');
  });
  card.querySelector('#reviewSkip').addEventListener('click', async () => {
    await act('/api/review', { skipped: true });
  });
}

function renderCoachCard(card) {
  const el = $('coachCard');
  if (!card) {
    el.classList.add('hidden');
    return;
  }
  el.className = 'coach-card';
  el.innerHTML = `
    <p class="coach-msg">🧡 ${esc(card.bericht)}</p>
    <div class="coach-actions">
      ${card.acties
        .map((a) => `<button type="button" data-coach-action="${esc(a.type)}">${esc(a.label)}</button>`)
        .join('')}
    </div>`;
}

function renderAll() {
  renderHeader();
  renderToday();
  renderGoals();
  renderTasks();
  renderReview();
  $('reviewDay').value = String(S.settings.reviewDay);
}

/* ─── Acties ────────────────────────────────────────────── */
async function act(path, body) {
  const { state } = await api(path, { method: 'POST', body: JSON.stringify(body || {}) });
  S = state;
  renderAll();
  return state;
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  try {
    // Dag-loggen: één tik; nogmaals tikken = ongedaan maken.
    if (t.dataset.goal && t.dataset.level) {
      const g = S.goals.find((x) => x.id === Number(t.dataset.goal));
      const current = t.dataset.day === 'today' ? g?.todayLevel : g?.yesterdayLevel;
      const level = current === t.dataset.level ? null : t.dataset.level;
      await act(`/api/goals/${t.dataset.goal}/log`, { day: t.dataset.day, level });
      return;
    }
    if (t.dataset.task) {
      await act(`/api/tasks/${t.dataset.task}/toggle`);
      return;
    }
    if (t.dataset.edit) {
      editingGoalId = Number(t.dataset.edit);
      showNewForm = false;
      renderGoals();
      return;
    }
    if (t.dataset.pause) {
      editingGoalId = null;
      await patchGoal(t.dataset.pause, { pause_days: 7 });
      toast('Doel 1 week gepauzeerd. Kom terug wanneer jij wilt.');
      return;
    }
    if (t.dataset.archive) {
      editingGoalId = null;
      await patchGoal(t.dataset.archive, { status: 'archived' });
      return;
    }
    if (t.dataset.resume) {
      await patchGoal(t.dataset.resume, { status: 'active' });
      return;
    }
    if (t.id === 'newGoalBtn') {
      showNewForm = true;
      editingGoalId = null;
      renderGoals();
      return;
    }
    if (t.classList.contains('form-cancel')) {
      showNewForm = false;
      editingGoalId = null;
      renderGoals();
      return;
    }
    if (t.dataset.coachAction) {
      const { state, focusGoal } = await api('/api/coach/action', {
        method: 'POST',
        body: JSON.stringify({ type: t.dataset.coachAction }),
      });
      S = state;
      renderCoachCard(null);
      if (t.dataset.coachAction === 'verklein_minimum' && focusGoal) {
        editingGoalId = Number(focusGoal);
      }
      renderAll();
      if (t.dataset.coachAction === 'verklein_minimum') {
        document.querySelector('.goal-form input[name="minimum"]')?.focus();
        toast('Maak je minimum gerust kleiner — kleiner is beter.');
      }
      return;
    }
    if (t.id === 'yesterdayToggle') {
      $('yesterdayGoals').classList.toggle('hidden');
      renderToday();
      return;
    }
    if (t.id === 'exportBtn') {
      const res = await fetch('/api/export', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export mislukt.');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `coach-backup-${S.today.key}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Backup gedownload.');
      return;
    }
  } catch (err) {
    toast(err.message);
  }
});

async function patchGoal(id, fields) {
  const { state } = await api(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
  S = state;
  renderAll();
}

// Doel-formulieren (nieuw + bewerken)
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('.goal-form');
  if (!form) return;
  e.preventDefault();
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  const errEl = form.querySelector('.form-error');
  try {
    if (form.dataset.goal) {
      await patchGoal(form.dataset.goal, data);
      editingGoalId = null;
      renderAll();
      toast('Doel bijgewerkt.');
    } else {
      await act('/api/goals', data);
      showNewForm = false;
      renderAll();
      toast('Doel aangemaakt — kleine stappen, lange adem. 🧡');
    }
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
  }
});

// Taken toevoegen
$('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = $('taskInput').value.trim();
  if (!title) return;
  $('taskInput').value = '';
  try {
    await act('/api/tasks', { title });
  } catch (err) {
    toast(err.message);
  }
});

// Reviewdag-instelling
$('reviewDay').addEventListener('change', async (e) => {
  try {
    const { state } = await api('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ reviewDay: Number(e.target.value) }),
    });
    S = state;
    renderAll();
  } catch (err) {
    toast(err.message);
  }
});

// Import
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const { state, migrated } = await api('/api/import', { method: 'POST', body: JSON.stringify(json) });
    S = state;
    renderAll();
    toast(migrated ? 'Backup geïmporteerd en gemigreerd naar het nieuwe formaat.' : 'Backup geïmporteerd.');
  } catch (err) {
    toast(`Import mislukt: ${err.message}`);
  }
});

/* ─── Boot ──────────────────────────────────────────────── */
async function evaluateCoach() {
  try {
    const { card } = await api('/api/coach/evaluate', { method: 'POST' });
    renderCoachCard(card);
  } catch {
    renderCoachCard(null); // coach-uitval mag de app nooit raken
  }
}

async function refresh() {
  try {
    S = await api('/api/state');
    renderAll();
  } catch { /* login wordt al getoond door api() */ }
}

async function boot() {
  try {
    S = await api('/api/state');
  } catch {
    return;
  }
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  renderAll();
  evaluateCoach();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

// Ververs bij terugkeer naar het tabblad (o.a. voor de 03:00-dagovergang).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && token && S) {
    refresh();
    evaluateCoach();
  }
});
setInterval(() => {
  if (document.visibilityState === 'visible' && token && S) refresh();
}, 120000);

if (token) boot(); else showLogin();
