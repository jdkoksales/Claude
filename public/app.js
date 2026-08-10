/**
 * Samen — gedeelde agenda en doelen voor twee.
 *
 * Bewust zonder bouwstap of framework: één bestand dat de browser direct
 * begrijpt, zodat er over twee jaar nog steeds niets kapot is gegaan aan
 * verouderde afhankelijkheden.
 */

// ── Kleine hulpjes ─────────────────────────────────────────────────────────

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Bouwt een element. Tekst gaat altijd via textContent, nooit via innerHTML. */
function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Een pictogram uit de verzameling boven in index.html. */
function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

/** Voortgangsring met het percentage in het midden. */
function ring(pct, label) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'ring');
  svg.setAttribute('viewBox', '0 0 46 46');
  svg.setAttribute('aria-hidden', 'true');
  for (const cls of ['track', 'value']) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('class', cls);
    circle.setAttribute('cx', '23');
    circle.setAttribute('cy', '23');
    circle.setAttribute('r', String(radius));
    if (cls === 'value') {
      circle.setAttribute('stroke-dasharray', String(circumference));
      circle.setAttribute('stroke-dashoffset', String(circumference * (1 - Math.min(1, pct / 100))));
    }
    svg.append(circle);
  }
  return h('div', { class: 'ring-wrap' }, svg, h('span', { text: label }));
}

const fmtDay = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });
const fmtMonth = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' });

const asDate = (key) => new Date(`${key}T12:00:00Z`);
const dayLabel = (key) => fmtDay.format(asDate(key));
const shortLabel = (key) => fmtShort.format(asDate(key));

function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}
function weekday(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}
const weekStart = (key) => addDays(key, -(weekday(key) - 1));

function relativeDay(key, today) {
  if (key === today) return 'vandaag';
  if (key === addDays(today, 1)) return 'morgen';
  if (key === addDays(today, -1)) return 'gisteren';
  return null;
}

function nfmt(n) {
  return Number(n).toLocaleString('nl-NL', { maximumFractionDigits: 2 });
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ── Verbinding met de server ───────────────────────────────────────────────

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const err = new Error(payload?.error || `Er ging iets mis (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return payload;
}

// ── Toestand ───────────────────────────────────────────────────────────────

const state = {
  boot: null,
  me: null,
  data: null,
  tab: 'vandaag',
  weekOffset: 0,
  goalFilter: 'alles',
  showDoneTasks: false,
};

const userById = (id) => state.data?.users.find((u) => u.id === id) || null;
const partner = () => state.data?.users.find((u) => u.id !== state.me?.id) || null;

// Eigen kleur voor "samen", zodat die niet te verwarren is met een van jullie.
const BOTH_COLOR = '#8a63b8';

function ownerName(id) {
  if (id === 'both') return 'Samen';
  return userById(id)?.name || 'Onbekend';
}
function ownerColor(id) {
  if (id === 'both') return BOTH_COLOR;
  return userById(id)?.color || 'var(--muted)';
}

let toastTimer = null;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// ── Onderpaneel ────────────────────────────────────────────────────────────

function openSheet(title, buildBody) {
  const sheet = $('#sheet');
  $('#sheet-title').textContent = title;
  const body = $('#sheet-body');
  body.replaceChildren(buildBody());
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  const first = body.querySelector('input, select, textarea, button');
  if (first && window.matchMedia('(min-width: 640px)').matches) first.focus();
}

function closeSheet() {
  $('#sheet').hidden = true;
  document.body.style.overflow = '';
}

$('#sheet').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeSheet();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
});

/** Vraagt om bevestiging in hetzelfde onderpaneel, in plaats van confirm(). */
function confirmSheet(title, message, onYes, yesLabel = 'Verwijderen') {
  openSheet(title, () => h('div', { class: 'form' },
    h('p', { text: message }),
    h('div', { class: 'form-actions' },
      h('button', { class: 'btn', type: 'button', onclick: closeSheet }, 'Annuleren'),
      h('button', {
        class: 'btn danger',
        type: 'button',
        onclick: async () => {
          try {
            await onYes();
            closeSheet();
            await refresh();
          } catch (err) {
            toast(err.message);
          }
        },
      }, yesLabel))));
}

// ── Formuliervelden ────────────────────────────────────────────────────────

function field(label, control) {
  return h('div', { class: 'field' }, h('label', { text: label }), control);
}

function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'seg' });
  for (const opt of options) {
    const btn = h('button', {
      type: 'button',
      'aria-pressed': String(opt.value === value),
      text: opt.label,
      onclick: () => {
        $$('button', wrap).forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        onChange(opt.value);
      },
    });
    wrap.append(btn);
  }
  return wrap;
}

function ownerSelect(value) {
  const sel = h('select', { name: 'ownerId' });
  for (const u of state.data.users) {
    sel.append(h('option', { value: u.id, selected: u.id === value, text: u.name }));
  }
  sel.append(h('option', { value: 'both', selected: value === 'both', text: 'Samen' }));
  return sel;
}

function errorLine() {
  return h('p', { class: 'error', hidden: true });
}

/** Verzamelt formulierwaarden, stuurt ze op en toont een fout in het paneel. */
function submitter(form, err, send) {
  return async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    err.hidden = true;
    try {
      await send(Object.fromEntries(new FormData(form)));
      closeSheet();
      await refresh();
    } catch (error) {
      err.textContent = error.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  };
}

// ── Formulier: afspraak ────────────────────────────────────────────────────

function eventForm(existing, presetDate) {
  const ev = existing || {};
  const err = errorLine();
  let allDay = Boolean(ev.allDay);
  let repeatFreq = ev.repeat?.freq || 'none';

  const timeRow = h('div', { class: 'grid-2' },
    field('Van', h('input', { type: 'time', name: 'start', value: ev.start || '09:00', required: true })),
    field('Tot', h('input', { type: 'time', name: 'end', value: ev.end || '' })));

  const reminderRow = field('Herinnering',
    h('select', { name: 'reminderMin' },
      h('option', { value: '', selected: ev.reminderMin == null, text: 'Geen' }),
      ...[5, 10, 15, 30, 60, 120, 720, 1440].map((m) => h('option', {
        value: String(m),
        selected: ev.reminderMin === m,
        text: m < 60 ? `${m} min vooraf`
          : m < 1440 ? `${m / 60} uur vooraf`
            : '1 dag vooraf',
      }))));

  const repeatUntil = field('Herhalen t/m (leeg = eindeloos)',
    h('input', { type: 'date', name: 'repeatUntil', value: ev.repeat?.until || '' }));
  repeatUntil.hidden = repeatFreq === 'none';

  const form = h('form', { class: 'form' },
    field('Wat', h('input', { name: 'title', value: ev.title || '', placeholder: 'Bijv. tandarts', required: true, maxlength: '120' })),
    field('Van wie', ownerSelect(ev.ownerId || state.me.id)),
    field('Datum', h('input', { type: 'date', name: 'date', value: ev.date || presetDate || state.data.today, required: true })),
    h('label', { class: 'switch' },
      h('input', {
        type: 'checkbox',
        name: 'allDay',
        checked: allDay,
        onchange: (e) => {
          allDay = e.target.checked;
          timeRow.hidden = allDay;
          reminderRow.hidden = allDay;
          $('input[name=start]', timeRow).required = !allDay;
        },
      }),
      h('span', { class: 'row-main' }, 'Hele dag')),
    timeRow,
    reminderRow,
    field('Waar', h('input', { name: 'location', value: ev.location || '', placeholder: 'Optioneel', maxlength: '120' })),
    field('Herhaling',
      h('select', {
        name: 'repeatFreq',
        onchange: (e) => {
          repeatFreq = e.target.value;
          repeatUntil.hidden = repeatFreq === 'none';
        },
      },
      ...[['none', 'Eenmalig'], ['daily', 'Elke dag'], ['weekly', 'Elke week'], ['monthly', 'Elke maand'], ['yearly', 'Elk jaar']]
        .map(([v, l]) => h('option', { value: v, selected: repeatFreq === v, text: l })))),
    repeatUntil,
    field('Notitie', h('textarea', { name: 'notes', maxlength: '2000' }, ev.notes || '')),
    err,
    h('div', { class: 'form-actions' },
      existing && h('button', {
        class: 'btn danger',
        type: 'button',
        onclick: () => confirmSheet('Afspraak verwijderen',
          ev.repeat ? 'Deze afspraak herhaalt zich. De hele reeks wordt verwijderd.' : 'Weet je het zeker?',
          () => api(`/events/${ev.id}`, { method: 'DELETE' })),
      }, 'Verwijderen'),
      h('button', { class: 'btn primary', type: 'submit' }, existing ? 'Opslaan' : 'Toevoegen')));

  timeRow.hidden = allDay;
  reminderRow.hidden = allDay;

  form.addEventListener('submit', submitter(form, err, async (values) => {
    const payload = {
      title: values.title,
      ownerId: values.ownerId,
      date: values.date,
      allDay: values.allDay === 'on',
      start: values.start || null,
      end: values.end || null,
      location: values.location || '',
      notes: values.notes || '',
      reminderMin: values.reminderMin === '' ? null : Number(values.reminderMin),
      repeat: values.repeatFreq === 'none'
        ? null
        : { freq: values.repeatFreq, interval: 1, until: values.repeatUntil || null },
    };
    if (existing) await api(`/events/${ev.id}`, { method: 'PATCH', body: payload });
    else await api('/events', { method: 'POST', body: payload });
  }));

  return form;
}

// ── Formulier: doel ────────────────────────────────────────────────────────

function goalForm(existing) {
  const goal = existing || {};
  const err = errorLine();
  let kind = goal.kind || 'habit';
  let cadence = goal.cadence?.type === 'weekly' ? 'weekly' : 'daily';

  const timesPerWeek = field('Hoe vaak per week',
    h('input', { type: 'number', name: 'timesPerWeek', min: '1', max: '7', value: String(goal.cadence?.timesPerWeek || 3) }));
  timesPerWeek.hidden = cadence !== 'weekly';

  const habitBlock = h('div', { class: 'form' },
    field('Ritme', segmented(
      [{ value: 'daily', label: 'Elke dag' }, { value: 'weekly', label: 'X keer per week' }],
      cadence,
      (v) => { cadence = v; timesPerWeek.hidden = v !== 'weekly'; },
    )),
    timesPerWeek);

  const projectBlock = h('div', { class: 'form' },
    h('div', { class: 'grid-2' },
      field('Streefgetal', h('input', { type: 'number', name: 'target', step: 'any', min: '0.01', value: goal.target != null ? String(goal.target) : '', placeholder: '3000' })),
      field('Eenheid', h('input', { name: 'unit', value: goal.unit || '', placeholder: '€, km, x', maxlength: '20' }))),
    field('Streefdatum', h('input', { type: 'date', name: 'deadline', value: goal.deadline || '' })));

  const setKind = (v) => {
    kind = v;
    habitBlock.hidden = v !== 'habit';
    projectBlock.hidden = v !== 'project';
  };

  const form = h('form', { class: 'form' },
    !existing && field('Soort', segmented(
      [{ value: 'habit', label: 'Gewoonte' }, { value: 'project', label: 'Project' }],
      kind,
      setKind,
    )),
    field('Doel', h('input', { name: 'title', value: goal.title || '', placeholder: 'Bijv. 3x per week sporten', required: true, maxlength: '120' })),
    field('Van wie', ownerSelect(goal.ownerId || state.me.id)),
    habitBlock,
    projectBlock,
    field('Toelichting', h('textarea', { name: 'note', maxlength: '500', placeholder: 'Waarom wil je dit?' }, goal.note || '')),
    err,
    h('div', { class: 'form-actions' },
      existing && h('button', {
        class: 'btn danger',
        type: 'button',
        onclick: () => confirmSheet('Doel verwijderen',
          'Het doel en de hele geschiedenis verdwijnen. Dit kan niet ongedaan gemaakt worden.',
          () => api(`/goals/${goal.id}`, { method: 'DELETE' })),
      }, 'Verwijderen'),
      h('button', { class: 'btn primary', type: 'submit' }, existing ? 'Opslaan' : 'Toevoegen')));

  setKind(kind);

  form.addEventListener('submit', submitter(form, err, async (values) => {
    const payload = {
      kind,
      title: values.title,
      ownerId: values.ownerId,
      note: values.note || '',
    };
    if (kind === 'habit') {
      payload.cadence = cadence === 'weekly'
        ? { type: 'weekly', timesPerWeek: Number(values.timesPerWeek) }
        : { type: 'daily' };
    } else {
      payload.target = Number(values.target);
      payload.unit = values.unit || 'x';
      payload.deadline = values.deadline || null;
    }
    if (existing) await api(`/goals/${goal.id}`, { method: 'PATCH', body: payload });
    else await api('/goals', { method: 'POST', body: payload });
  }));

  return form;
}

// ── Formulier: bijdrage aan een project ────────────────────────────────────

function entryForm(goal) {
  const err = errorLine();
  const form = h('form', { class: 'form' },
    h('p', { class: 'muted', text: `${goal.title} — nu ${nfmt(goal.stats.total)} van ${nfmt(goal.target)} ${goal.unit}` }),
    field(`Hoeveel erbij (${goal.unit})`,
      h('input', { type: 'number', name: 'amount', step: 'any', required: true, autofocus: true, placeholder: '50' })),
    field('Datum', h('input', { type: 'date', name: 'date', value: state.data.today })),
    field('Notitie', h('input', { name: 'note', maxlength: '200', placeholder: 'Optioneel' })),
    err,
    h('div', { class: 'form-actions' },
      h('button', { class: 'btn', type: 'button', onclick: closeSheet }, 'Annuleren'),
      h('button', { class: 'btn primary', type: 'submit' }, 'Bijschrijven')));

  form.addEventListener('submit', submitter(form, err, (values) => api(`/goals/${goal.id}/entries`, {
    method: 'POST',
    body: { amount: Number(values.amount), date: values.date, note: values.note },
  })));
  return form;
}

// ── Formulier: taak ────────────────────────────────────────────────────────

function taskForm(existing) {
  const task = existing || {};
  const err = errorLine();
  const form = h('form', { class: 'form' },
    field('Taak', h('input', { name: 'title', value: task.title || '', required: true, maxlength: '140', placeholder: 'Bijv. cadeau kopen' })),
    field('Voor wie',
      h('select', { name: 'assigneeId' },
        h('option', { value: '', selected: !task.assigneeId, text: 'Wie het eerst kan' }),
        ...state.data.users.map((u) => h('option', { value: u.id, selected: task.assigneeId === u.id, text: u.name })),
        h('option', { value: 'both', selected: task.assigneeId === 'both', text: 'Samen' }))),
    field('Wanneer af', h('input', { type: 'date', name: 'dueDate', value: task.dueDate || '' })),
    err,
    h('div', { class: 'form-actions' },
      existing && h('button', {
        class: 'btn danger',
        type: 'button',
        onclick: () => confirmSheet('Taak verwijderen', 'Weet je het zeker?', () => api(`/tasks/${task.id}`, { method: 'DELETE' })),
      }, 'Verwijderen'),
      h('button', { class: 'btn primary', type: 'submit' }, existing ? 'Opslaan' : 'Toevoegen')));

  form.addEventListener('submit', submitter(form, err, async (values) => {
    const payload = {
      title: values.title,
      assigneeId: values.assigneeId || null,
      dueDate: values.dueDate || null,
    };
    if (existing) await api(`/tasks/${task.id}`, { method: 'PATCH', body: payload });
    else await api('/tasks', { method: 'POST', body: payload });
  }));
  return form;
}

// ── Onderdelen die in meerdere schermen terugkomen ─────────────────────────

function personChip(id) {
  return h('span', { class: 'chip' },
    h('i', { class: 'dot', style: { background: ownerColor(id) } }),
    ownerName(id));
}

function eventRow(ev, onClick) {
  return h('button', { class: 'ev', type: 'button', onclick: onClick },
    h('span', { class: 'ev-time', text: ev.allDay ? 'hele dag' : ev.start }),
    h('span', { class: 'ev-bar', style: { background: ownerColor(ev.ownerId) } }),
    h('span', { class: 'ev-main' },
      h('span', { class: 'ev-title', text: ev.title }),
      h('span', { class: 'ev-sub' },
        [ownerName(ev.ownerId), ev.end && !ev.allDay ? `tot ${ev.end}` : null, ev.location, ev.repeatLabel]
          .filter(Boolean).join(' · '))));
}

function checkButton(goal) {
  const on = goal.stats.doneToday;
  return h('button', {
    class: 'check',
    type: 'button',
    'aria-pressed': String(on),
    'aria-label': on ? `${goal.title} afvinken ongedaan maken` : `${goal.title} afvinken`,
    onclick: async (e) => {
      e.stopPropagation();
      try {
        await api(`/goals/${goal.id}/checkin`, { method: 'POST', body: { date: state.data.today } });
        await refresh();
      } catch (err) {
        toast(err.message);
      }
    },
  }, icon('check'));
}

function weekDots(goal) {
  const start = weekStart(state.data.today);
  const wrap = h('div', { class: 'week-dots' });
  const byDate = new Map(goal.stats.history.map((d) => [d.date, d]));
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(start, i);
    const day = byDate.get(date);
    wrap.append(h('i', {
      class: [day?.done ? 'on' : '', date === state.data.today ? 'today' : ''].filter(Boolean).join(' '),
      title: date,
    }));
  }
  return wrap;
}

function heatmap(goal) {
  const wrap = h('div', { class: 'heat' });
  for (const day of goal.stats.history) {
    wrap.append(h('i', {
      class: [day.done ? 'on' : '', day.date > state.data.today ? 'future' : ''].filter(Boolean).join(' '),
      title: `${day.date}${day.done ? ' — gedaan' : ''}`,
    }));
  }
  return wrap;
}

function progressBar(pct) {
  // Bij 0% helemaal geen streepje: een klein bolletje suggereert voortgang
  // die er niet is.
  const width = pct <= 0 ? 0 : Math.max(4, pct);
  return h('div', { class: 'bar' }, h('span', { style: { width: `${width}%` } }));
}

function goalCard(goal, { compact = false } = {}) {
  const s = goal.stats;
  const head = h('div', { class: 'card-head named' },
    h('div', { style: { minWidth: '0' } },
      h('h2', { text: goal.title }),
      h('p', { class: 'muted', text: goal.kind === 'habit'
        ? `${s.daily ? 'elke dag' : `${s.weekTarget}× per week`} · ${ownerName(goal.ownerId)}`
        : `${ownerName(goal.ownerId)}${goal.deadline ? ` · streefdatum ${shortLabel(goal.deadline)}` : ''}` })),
    h('button', {
      class: 'icon-btn ghost',
      type: 'button',
      'aria-label': 'Doel aanpassen',
      onclick: () => openSheet('Doel aanpassen', () => goalForm(goal)),
    }, icon('edit')));

  const body = h('div', { class: 'card-body' });

  if (goal.kind === 'habit') {
    body.append(h('div', { class: 'row', style: { padding: '0' } },
      checkButton(goal),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', text: s.doneToday ? 'Vandaag gedaan' : 'Vandaag nog niet' }),
        h('div', { class: 'row-sub', text: s.doneToday && goal.ownerId === 'both' && s.checkedToday.length
          ? `door ${s.checkedToday.map(ownerName).join(' en ')}`
          : `deze week ${s.weekDone} van ${s.weekTarget}` })),
      h('div', { class: 'row-end' },
        h('div', { class: 'big', text: String(s.streak) }),
        h('div', { class: 'muted', text: s.streakUnit }))));
    body.append(weekDots(goal));
    if (!compact) {
      body.append(heatmap(goal));
      body.append(h('p', { class: 'muted', text: `${s.totalDone}× in de afgelopen 13 weken · langste reeks ${plural(s.longest, 'dag', 'dagen')}` }));
    }
  } else {
    body.append(h('div', { class: 'row', style: { padding: '0' } },
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', text: `${nfmt(s.total)} / ${nfmt(s.target)} ${goal.unit}` }),
        h('div', { class: 'row-sub', text: s.daysLeft == null ? `${s.pct}% gehaald`
          : s.daysLeft > 0 ? `nog ${nfmt(s.remaining)} ${goal.unit} in ${s.daysLeft} dagen`
            : s.remaining > 0 ? `streefdatum voorbij, nog ${nfmt(s.remaining)} ${goal.unit}` : 'gehaald' })),
      h('div', { class: 'row-end' },
        h('div', { class: 'big', text: `${s.pct}%` }),
        s.onTrack != null && h('div', { class: 'muted', text: s.onTrack ? 'op schema' : 'achterop' }))));
    body.append(progressBar(s.pct));
    if (!compact) {
      if (goal.ownerId === 'both' && Object.keys(s.perPerson).length) {
        body.append(h('div', { class: 'pills' },
          ...Object.entries(s.perPerson).map(([uid, amount]) => h('span', { class: 'chip' },
            h('i', { class: 'dot', style: { background: ownerColor(uid) } }),
            `${ownerName(uid)}: ${nfmt(amount)} ${goal.unit}`))));
      }
      body.append(h('button', {
        class: 'btn block',
        type: 'button',
        onclick: () => openSheet('Bijschrijven', () => entryForm(goal)),
      }, '+ Bijschrijven'));
      if ((goal.entries || []).length) {
        const recent = [...goal.entries].slice(-5).reverse();
        body.append(h('div', { class: 'card-body tight' },
          ...recent.map((e) => h('div', { class: 'row' },
            h('div', { class: 'row-main' },
              h('div', { class: 'row-title', text: `${nfmt(e.amount)} ${goal.unit}` }),
              h('div', { class: 'row-sub', text: [shortLabel(e.date), ownerName(e.userId), e.note].filter(Boolean).join(' · ') })),
            h('button', {
              class: 'icon-btn ghost',
              type: 'button',
              'aria-label': 'Bijdrage verwijderen',
              onclick: () => confirmSheet('Bijdrage verwijderen', `${nfmt(e.amount)} ${goal.unit} van ${shortLabel(e.date)} wordt teruggedraaid.`,
                () => api(`/goals/${goal.id}/entries/${e.id}`, { method: 'DELETE' })),
            }, icon('close'))))));
      }
    }
  }

  if (goal.note && !compact) body.append(h('p', { class: 'muted', text: goal.note }));
  return h('section', { class: 'card' }, head, body);
}

function taskRow(task) {
  return h('div', { class: 'row' },
    h('button', {
      class: 'check',
      type: 'button',
      'aria-pressed': String(task.done),
      'aria-label': task.done ? 'Weer openzetten' : 'Afvinken',
      onclick: async () => {
        try {
          await api(`/tasks/${task.id}`, { method: 'PATCH', body: { done: !task.done } });
          await refresh();
        } catch (err) {
          toast(err.message);
        }
      },
    }, icon('check')),
    h('button', {
      class: 'row-main',
      type: 'button',
      style: { border: '0', background: 'none', textAlign: 'left', padding: '0' },
      onclick: () => openSheet('Taak aanpassen', () => taskForm(task)),
    },
    h('div', { class: 'row-title', style: task.done ? { textDecoration: 'line-through', opacity: '.6' } : {}, text: task.title }),
    h('div', { class: 'row-sub', text: [
      task.assigneeId ? ownerName(task.assigneeId) : 'wie het eerst kan',
      task.dueDate ? (relativeDay(task.dueDate, state.data.today) || shortLabel(task.dueDate)) : null,
      task.done && task.doneBy ? `afgevinkt door ${ownerName(task.doneBy)}` : null,
    ].filter(Boolean).join(' · ') })),
    task.dueDate && !task.done && task.dueDate < state.data.today
      && h('span', { class: 'chip warn' }, 'te laat'));
}

function card(title, action, ...body) {
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', { text: title }), action || h('span')),
    ...body);
}

function emptyNote(text, iconName = 'sparkle') {
  return h('div', { class: 'empty' }, icon(iconName), h('p', { text }));
}

/** De twee gezichten rechtsboven; die van jou heeft een ring om zich heen. */
function renderAvatars() {
  const wrap = $('#avatars');
  wrap.replaceChildren(...state.data.users.map((u) => h('span', {
    class: `avatar${u.id === state.me.id ? ' is-me' : ''}`,
    style: { background: u.color },
    title: u.id === state.me.id ? `${u.name} (jij)` : u.name,
    text: u.name.trim().charAt(0).toUpperCase(),
  })));
}

// ── Scherm: Vandaag ────────────────────────────────────────────────────────

function renderVandaag(root) {
  const { today, events, goals, tasks } = state.data;
  const todays = events.filter((e) => e.date === today);
  const mine = goals.filter((g) => !g.archived && g.kind === 'habit'
    && (g.ownerId === state.me.id || g.ownerId === 'both'));
  const theirs = goals.filter((g) => !g.archived && g.kind === 'habit'
    && g.ownerId !== state.me.id && g.ownerId !== 'both');
  const projects = goals.filter((g) => !g.archived && g.kind === 'project');
  const dueTasks = tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= today);

  root.append(card('Agenda vandaag',
    h('button', { class: 'btn ghost', type: 'button', onclick: () => openSheet('Nieuwe afspraak', () => eventForm(null, today)) }, '+ Afspraak'),
    todays.length
      ? h('div', { class: 'day-body' }, ...todays.map((ev) => eventRow(ev, () => openSheet('Afspraak', () => eventForm(ev)))))
      : emptyNote('Niets gepland vandaag. Geniet ervan.', 'calendar-empty')));

  const doneCount = mine.filter((g) => g.stats.doneToday).length;
  root.append(card('Jouw doelen',
    mine.length
      ? ring(Math.round((doneCount / mine.length) * 100), `${doneCount}/${mine.length}`)
      : null,
    mine.length
      ? h('div', { class: 'card-body tight' }, ...mine.map((goal) => h('div', { class: 'row' },
        checkButton(goal),
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title', text: goal.title }),
          h('div', { class: 'row-sub', text: goal.stats.daily
            ? `reeks van ${goal.stats.streak} ${goal.stats.streakUnit}`
            : `deze week ${goal.stats.weekDone} van ${goal.stats.weekTarget}` })),
        goal.ownerId === 'both' && h('span', { class: 'chip' }, 'samen'))))
      : emptyNote('Nog geen gewoontes. Voeg er een toe via de plusknop.', 'target')));

  if (theirs.length) {
    root.append(card(`Doelen van ${partner()?.name || 'de ander'}`,
      null,
      h('div', { class: 'card-body tight' }, ...theirs.map((goal) => h('div', { class: 'row' },
        h('span', { class: `chip${goal.stats.doneToday ? ' done' : ''}` },
          goal.stats.doneToday ? 'gedaan' : 'nog niet'),
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title', text: goal.title }),
          h('div', { class: 'row-sub', text: goal.stats.daily
            ? `reeks van ${goal.stats.streak} ${goal.stats.streakUnit}`
            : `deze week ${goal.stats.weekDone} van ${goal.stats.weekTarget}` })))))));
  }

  if (projects.length) {
    root.append(card('Projecten', null,
      h('div', { class: 'card-body' }, ...projects.map((goal) => h('div', {},
        h('div', { class: 'row', style: { padding: '0 0 6px' } },
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title', text: goal.title }),
            h('div', { class: 'row-sub', text: `${nfmt(goal.stats.total)} / ${nfmt(goal.target)} ${goal.unit} · ${ownerName(goal.ownerId)}` })),
          h('div', { class: 'row-end', text: `${goal.stats.pct}%` })),
        progressBar(goal.stats.pct))))));
  }

  root.append(card('Taken die spelen',
    h('button', { class: 'btn ghost', type: 'button', onclick: () => openSheet('Nieuwe taak', () => taskForm(null)) }, '+ Taak'),
    dueTasks.length
      ? h('div', { class: 'card-body tight' }, ...dueTasks.map(taskRow))
      : emptyNote('Geen taken voor vandaag.', 'check-list')));
}

// ── Scherm: Week ───────────────────────────────────────────────────────────

function renderWeek(root) {
  const { today, users, goals } = state.data;
  const start = addDays(weekStart(today), state.weekOffset * 7);

  root.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('button', { class: 'icon-btn ghost', type: 'button', 'aria-label': 'Vorige week', onclick: () => { state.weekOffset -= 1; refresh(); } }, icon('left')),
      h('div', { style: { textAlign: 'center' } },
        h('h2', { class: 'week-title', text: state.weekOffset === 0 ? 'Deze week' : `${shortLabel(start)} – ${shortLabel(addDays(start, 6))}` }),
        h('p', { class: 'muted', text: fmtMonth.format(asDate(start)) })),
      h('button', { class: 'icon-btn ghost', type: 'button', 'aria-label': 'Volgende week', onclick: () => { state.weekOffset += 1; refresh(); } }, icon('right'))),
    h('div', { class: 'card-body' },
      h('div', { class: 'legend' },
        ...users.map((u) => personChip(u.id)),
        personChip('both'),
        state.weekOffset !== 0 && h('button', { class: 'btn ghost', type: 'button', onclick: () => { state.weekOffset = 0; refresh(); } }, 'Naar deze week')))));

  const strip = h('div', { class: 'daystrip' });
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(start, i);
    const dayEvents = state.data.events.filter((e) => e.date === date);
    const rel = relativeDay(date, today);
    strip.append(h('article', { class: `day${date === today ? ' is-today' : ''}` },
      h('div', { class: 'day-head' },
        h('span', { text: dayLabel(date) }),
        rel && h('span', { class: 'muted', text: rel })),
      h('div', { class: 'day-body' },
        dayEvents.length
          ? dayEvents.map((ev) => eventRow(ev, () => openSheet('Afspraak', () => eventForm(ev))))
          : h('button', {
            class: 'ev is-free',
            type: 'button',
            onclick: () => openSheet('Nieuwe afspraak', () => eventForm(null, date)),
          }, h('span', { class: 'ev-time' }, icon('plus')), h('span', { text: 'vrij — iets plannen?' })))));
  }
  root.append(strip);

  // Hoe staan de doelen er deze week voor, per persoon naast elkaar.
  const habits = goals.filter((g) => !g.archived && g.kind === 'habit');
  if (habits.length) {
    const body = h('div', { class: 'card-body' });
    for (const owner of [...users.map((u) => u.id), 'both']) {
      const mine = habits.filter((g) => g.ownerId === owner);
      if (!mine.length) continue;
      body.append(h('div', {},
        h('div', { class: 'row', style: { padding: '2px 0' } },
          h('i', { class: 'dot', style: { background: ownerColor(owner) } }),
          h('strong', { class: 'row-main', text: ownerName(owner) }),
          h('span', { class: 'muted', text: `${mine.filter((g) => g.stats.weekDone >= g.stats.weekTarget).length}/${mine.length} op koers` })),
        ...mine.map((goal) => h('div', { class: 'row', style: { padding: '4px 0' } },
          h('div', { class: 'row-main' },
            h('div', { class: 'row-sub', text: goal.title })),
          weekDots(goal),
          h('span', { class: 'row-end muted', text: `${goal.stats.weekDone}/${goal.stats.weekTarget}` })))));
    }
    root.append(card('Doelen deze week', null, body));
  }
}

// ── Scherm: Doelen ─────────────────────────────────────────────────────────

function renderDoelen(root) {
  const { goals, users } = state.data;
  const filters = [
    { value: 'alles', label: 'Alles' },
    { value: state.me.id, label: 'Jij' },
    ...(partner() ? [{ value: partner().id, label: partner().name }] : []),
    { value: 'both', label: 'Samen' },
  ];
  root.append(h('div', { class: 'card' }, h('div', { class: 'card-body' },
    segmented(filters, state.goalFilter, (v) => { state.goalFilter = v; refresh(); }))));

  const active = goals.filter((g) => !g.archived
    && (state.goalFilter === 'alles' || g.ownerId === state.goalFilter));
  const archived = goals.filter((g) => g.archived);

  if (!active.length) {
    root.append(card('Doelen',
      h('button', { class: 'btn ghost', type: 'button', onclick: () => openSheet('Nieuw doel', () => goalForm(null)) }, '+ Doel'),
      emptyNote('Nog geen doelen hier. Begin met één gewoonte — dat werkt beter dan vijf tegelijk.', 'target')));
  } else {
    for (const goal of active.filter((g) => g.kind === 'habit')) root.append(goalCard(goal));
    for (const goal of active.filter((g) => g.kind === 'project')) root.append(goalCard(goal));
  }

  if (archived.length) {
    root.append(card('Archief', null, h('div', { class: 'card-body tight' },
      ...archived.map((goal) => h('div', { class: 'row' },
        h('div', { class: 'row-main' },
          h('div', { class: 'row-title', text: goal.title }),
          h('div', { class: 'row-sub', text: ownerName(goal.ownerId) })),
        h('button', {
          class: 'btn ghost',
          type: 'button',
          onclick: async () => {
            await api(`/goals/${goal.id}`, { method: 'PATCH', body: { archived: false } });
            await refresh();
          },
        }, 'Terughalen'))))));
  }

  if (active.length) {
    root.append(h('button', {
      class: 'btn block',
      type: 'button',
      onclick: () => openSheet('Nieuw doel', () => goalForm(null)),
    }, '+ Doel toevoegen'));
  }
}

// ── Scherm: Taken ──────────────────────────────────────────────────────────

function renderTaken(root) {
  const { tasks, today } = state.data;
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done)
    .sort((a, b) => (a.doneAt < b.doneAt ? 1 : -1));

  const sorted = [...open].sort((a, b) => {
    const ad = a.dueDate || '9999-12-31';
    const bd = b.dueDate || '9999-12-31';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });

  root.append(card(`Open · ${open.length}`,
    h('button', { class: 'btn ghost', type: 'button', onclick: () => openSheet('Nieuwe taak', () => taskForm(null)) }, '+ Taak'),
    sorted.length
      ? h('div', { class: 'card-body tight' }, ...sorted.map(taskRow))
      : emptyNote('Alles is af. Mooi.', 'check')));

  if (done.length) {
    root.append(card(`Afgevinkt · ${done.length}`,
      h('button', {
        class: 'btn ghost',
        type: 'button',
        onclick: () => confirmSheet('Afgevinkte taken opruimen',
          `${done.length} afgevinkte taken worden verwijderd.`,
          () => api('/tasks/clear-done', { method: 'POST' }), 'Opruimen'),
      }, 'Opruimen'),
      h('div', { class: 'card-body tight' }, ...done.slice(0, 20).map(taskRow))));
  }

  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).length;
  if (overdue) root.append(h('p', { class: 'muted', text: `${overdue} taak/taken staan over datum.` }));
}

// ── Scherm: Meer ───────────────────────────────────────────────────────────

function renderMeer(root) {
  root.append(card('Jij', null, h('div', { class: 'card-body' },
    h('div', { class: 'row', style: { padding: '0' } },
      h('i', { class: 'dot', style: { background: state.me.color, width: '14px', height: '14px' } }),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title', text: state.me.name }),
        h('div', { class: 'row-sub', text: partner() ? `samen met ${partner().name}` : 'nog niemand anders' }))),
    h('button', { class: 'btn block', type: 'button', onclick: () => openSheet('Pincode wijzigen', pinForm) }, 'Pincode wijzigen'),
    h('button', {
      class: 'btn block',
      type: 'button',
      onclick: async () => { await api('/logout', { method: 'POST' }); location.reload(); },
    }, 'Uitloggen'))));

  root.append(card('Herinneringen', null, h('div', { class: 'card-body' }, ...notificationControls())));

  root.append(card('Back-up', null, h('div', { class: 'card-body' },
    h('p', { class: 'muted', text: 'Zet af en toe een kopie van jullie gegevens veilig. Bij terugzetten worden agenda, doelen en taken vervangen; jullie inloggegevens blijven staan.' }),
    h('a', { class: 'btn block', href: '/api/export', download: '' }, 'Gegevens downloaden'),
    h('button', { class: 'btn block', type: 'button', onclick: importBackup }, 'Back-up terugzetten'))));

  root.append(card('Over deze app', null, h('div', { class: 'card-body' },
    h('p', { class: 'muted', text: 'Alles wat jullie invoeren is voor elkaar zichtbaar: afspraken, doelen en taken. Er kan verder niemand bij — de gegevens staan in jullie eigen database.' }),
    h('p', { class: 'muted', text: `Tijdzone: ${state.boot.timezone}` }))));
}

function pinForm() {
  const err = errorLine();
  const form = h('form', { class: 'form' },
    field('Huidige pincode', h('input', { type: 'password', inputmode: 'numeric', name: 'current', class: 'pin-input', required: true, autocomplete: 'current-password' })),
    field('Nieuwe pincode (4-10 cijfers)', h('input', { type: 'password', inputmode: 'numeric', name: 'next', class: 'pin-input', required: true, pattern: '\\d{4,10}', autocomplete: 'new-password' })),
    err,
    h('div', { class: 'form-actions' },
      h('button', { class: 'btn', type: 'button', onclick: closeSheet }, 'Annuleren'),
      h('button', { class: 'btn primary', type: 'submit' }, 'Opslaan')));
  form.addEventListener('submit', submitter(form, err, async (values) => {
    await api('/me/pin', { method: 'PATCH', body: values });
    toast('Pincode gewijzigd.');
  }));
  return form;
}

function notificationControls() {
  if (!state.boot.push.available) {
    return [h('p', { class: 'muted', text: 'Herinneringen staan uit: er zijn geen VAPID-sleutels ingesteld op de server. Zie de README om ze aan te zetten.' })];
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return [h('p', { class: 'muted', text: 'Deze browser kan geen meldingen tonen. Op de iPhone werkt het alleen als je de app eerst op je beginscherm zet.' })];
  }
  const status = h('p', { class: 'muted', text: Notification.permission === 'granted' ? 'Meldingen staan aan.' : 'Meldingen staan nog uit.' });
  return [
    status,
    h('button', {
      class: 'btn block primary',
      type: 'button',
      onclick: async (e) => {
        e.target.disabled = true;
        try {
          await enablePush();
          status.textContent = 'Meldingen staan aan.';
          toast('Meldingen staan aan.');
        } catch (err) {
          toast(err.message);
        } finally {
          e.target.disabled = false;
        }
      },
    }, 'Meldingen aanzetten op dit apparaat'),
    h('button', {
      class: 'btn block',
      type: 'button',
      onclick: async () => {
        const res = await api('/push/test', { method: 'POST' });
        toast(res.sent ? 'Testmelding verstuurd.' : 'Geen apparaten gevonden — zet meldingen eerst aan.');
      },
    }, 'Testmelding sturen'),
    h('p', { class: 'muted', text: 'Je krijgt een seintje vóór een afspraak met herinnering, en één keer per dag een overzicht van doelen die nog openstaan.' }),
  ];
}

function importBackup() {
  const input = h('input', { type: 'file', accept: 'application/json' });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast('Dit bestand is geen geldige back-up.');
      return;
    }
    confirmSheet('Back-up terugzetten',
      'Jullie huidige agenda, doelen en taken worden vervangen door de inhoud van dit bestand.',
      async () => {
        await api('/import', { method: 'POST', body: { data: parsed } });
        toast('Back-up teruggezet.');
      }, 'Terugzetten');
  });
  input.click();
}

// ── Meldingen aanzetten ────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Je hebt meldingen geweigerd in de browser.');
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing || await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(state.boot.push.key),
  });
  await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
}

// ── Inloggen en inrichten ──────────────────────────────────────────────────

/** Het beeldmerk op het inlogscherm: twee cirkels die elkaar overlappen. */
function gateMark() {
  const svg = icon('mark');
  svg.setAttribute('class', 'gate-mark');
  svg.style.color = 'var(--accent)';
  return svg;
}

function renderSetup() {
  const card = $('#gate-card');
  const err = errorLine();
  const rows = [0, 1].map((i) => h('div', { class: 'grid-2' },
    field(i === 0 ? 'Jouw naam' : 'Naam van je vriendin', h('input', { name: `name${i}`, required: true, maxlength: '40' })),
    field('Pincode', h('input', { name: `pin${i}`, class: 'pin-input', type: 'password', inputmode: 'numeric', pattern: '\\d{4,10}', required: true, autocomplete: 'new-password' }))));

  const form = h('form', { class: 'form' },
    gateMark(),
    h('h1', { text: 'Welkom bij Samen' }),
    h('p', { class: 'muted', text: 'Eenmalig instellen: twee namen en twee pincodes. Met je eigen pincode kom je binnen; daarna zien jullie elkaars agenda en doelen.' }),
    ...rows,
    err,
    h('button', { class: 'btn primary block', type: 'submit' }, 'Aanmaken'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    err.hidden = true;
    try {
      await api('/setup', {
        method: 'POST',
        body: { people: [0, 1].map((i) => ({ name: values[`name${i}`], pin: values[`pin${i}`] })) },
      });
      state.boot = await api('/bootstrap');
      renderLogin();
    } catch (error) {
      err.textContent = error.message;
      err.hidden = false;
    }
  });

  card.replaceChildren(form);
}

function renderLogin() {
  const card = $('#gate-card');
  const err = errorLine();
  let picked = state.boot.users[0]?.id;

  const who = h('div', { class: 'who' });
  const buttons = state.boot.users.map((u) => {
    const btn = h('button', {
      type: 'button',
      'aria-pressed': String(u.id === picked),
      onclick: () => {
        picked = u.id;
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === picked)));
        $('input[name=pin]', card)?.focus();
      },
      dataset: { id: u.id },
    }, h('i', { class: 'dot', style: { background: u.color, width: '12px', height: '12px' } }), u.name);
    who.append(btn);
    return btn;
  });

  const form = h('form', { class: 'form' },
    gateMark(),
    h('h1', { text: 'Samen' }),
    h('p', { class: 'muted', text: 'Wie ben je?' }),
    who,
    field('Pincode', h('input', {
      name: 'pin',
      class: 'pin-input',
      type: 'password',
      inputmode: 'numeric',
      autocomplete: 'current-password',
      required: true,
    })),
    err,
    h('button', { class: 'btn primary block', type: 'submit' }, 'Binnen'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const pin = new FormData(form).get('pin');
    try {
      const res = await api('/login', { method: 'POST', body: { userId: picked, pin } });
      state.me = res.user;
      await start();
    } catch (error) {
      err.textContent = error.message;
      err.hidden = false;
      $('input[name=pin]', form).value = '';
    }
  });

  card.replaceChildren(form);
}

// ── Schermbeheer ───────────────────────────────────────────────────────────

const TITLES = {
  vandaag: 'Vandaag',
  week: 'Week',
  doelen: 'Doelen',
  taken: 'Taken',
  meer: 'Meer',
};

const RENDERERS = {
  vandaag: renderVandaag,
  week: renderWeek,
  doelen: renderDoelen,
  taken: renderTaken,
  meer: renderMeer,
};

function setTab(tab) {
  state.tab = tab;
  $$('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== tab; });
  $('#view-title').textContent = TITLES[tab];
  const url = new URL(location.href);
  url.searchParams.set('tab', tab);
  history.replaceState(null, '', url);
  render();
}

$$('.tab').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

$('#add-btn').addEventListener('click', () => {
  if (state.tab === 'doelen') return openSheet('Nieuw doel', () => goalForm(null));
  if (state.tab === 'taken') return openSheet('Nieuwe taak', () => taskForm(null));
  return openSheet('Nieuw', () => h('div', { class: 'form' },
    h('button', { class: 'btn block', type: 'button', onclick: () => openSheet('Nieuwe afspraak', () => eventForm(null, state.data.today)) }, 'Afspraak in de agenda'),
    h('button', { class: 'btn block', type: 'button', onclick: () => openSheet('Nieuw doel', () => goalForm(null)) }, 'Doel'),
    h('button', { class: 'btn block', type: 'button', onclick: () => openSheet('Nieuwe taak', () => taskForm(null)) }, 'Taak')));
});

function render() {
  const root = $(`.view[data-view="${state.tab}"]`);
  if (!root || !state.data) return;
  renderAvatars();
  root.replaceChildren();
  RENDERERS[state.tab](root);

  const sub = $('#view-sub');
  if (state.tab === 'vandaag') sub.textContent = dayLabel(state.data.today);
  else if (state.tab === 'week') sub.textContent = '';
  else sub.textContent = '';
}

/** Haalt de gegevens opnieuw op en tekent het huidige scherm. */
async function refresh() {
  const anchor = state.data?.today || state.boot.today;
  const base = addDays(weekStart(anchor), state.weekOffset * 7);
  const from = state.weekOffset === 0 ? addDays(base, -7) : addDays(base, -1);
  const to = addDays(base, 21);
  state.data = await api(`/state?from=${from}&to=${to}`);
  render();
}

async function start() {
  $('#gate').hidden = true;
  $('#app').hidden = false;
  if (!state.me) state.me = (await api('/me')).user;
  await refresh();
  const wanted = new URL(location.href).searchParams.get('tab');
  setTab(RENDERERS[wanted] ? wanted : 'vandaag');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

async function boot() {
  try {
    state.boot = await api('/bootstrap');
  } catch {
    $('#gate-card').replaceChildren(h('div', { class: 'form' },
      h('h1', { text: 'Geen verbinding' }),
      h('p', { class: 'muted', text: 'De app kan de server niet bereiken. Controleer of hij draait en probeer het opnieuw.' }),
      h('button', { class: 'btn primary block', type: 'button', onclick: () => location.reload() }, 'Opnieuw proberen')));
    return;
  }
  if (state.boot.setupNeeded) renderSetup();
  else if (state.boot.me) await start();
  else renderLogin();
}

// Bij terugkeer naar de app opnieuw ophalen: de ander heeft misschien iets
// veranderd terwijl jouw telefoon in je zak zat.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.data) refresh().catch(() => {});
});

boot();
