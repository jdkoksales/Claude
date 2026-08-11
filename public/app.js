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
const fmtDow = new Intl.DateTimeFormat('nl-NL', { weekday: 'short' });

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

const CATEGORY_LABEL = { gewoon: 'Gewoon', leuk: 'Leuk ding', vakantie: 'Vakantie' };

/**
 * Hoe lang nog? In hele dagen, want daar denk je in als je ergens naar
 * uitkijkt. Een vakantie die al bezig is telt niet af maar zegt hoe ver je bent.
 */
function countdown(startDate, endDate, today) {
  const end = endDate || startDate;
  if (startDate > today) {
    const days = daysBetween(today, startDate);
    if (days === 1) return { label: 'morgen', soon: true };
    if (days <= 7) return { label: `over ${plural(days, 'dag', 'dagen')}`, soon: true };
    return { label: `over ${plural(days, 'dag', 'dagen')}`, soon: false };
  }
  if (end < today) {
    const days = daysBetween(end, today);
    if (days === 1) return { label: 'gisteren', past: true };
    if (days < 31) return { label: `${plural(days, 'dag', 'dagen')} geleden`, past: true };
    const months = Math.round(days / 30.4);
    if (months < 24) return { label: `${plural(months, 'maand', 'maanden')} geleden`, past: true };
    return { label: `${plural(Math.round(days / 365), 'jaar', 'jaar')} geleden`, past: true };
  }
  if (startDate === today && end === today) return { label: 'vandaag!', now: true };
  return { label: `dag ${daysBetween(startDate, today) + 1} van ${daysBetween(startDate, end) + 1}`, now: true };
}

function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Onder welke sleutel horen de foto's van dit voorkomen? Zie de server. */
const albumDate = (event, occurrenceDate) => (
  event.repeat ? (occurrenceDate || event.date) : event.date
);

/**
 * Verkleint een foto in de browser voordat hij wordt verstuurd. Een moderne
 * telefoonfoto is al gauw 5 MB; zo blijft er iets van een paar honderd kB over
 * dat er op een scherm nog steeds scherp uitziet.
 */
function shrinkImage(file, maxSide = 1600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Kon dit bestand niet lezen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Dit bestand is geen afbeelding.'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

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
  moments: null,
  momentFilter: 'komt',
  // Welke agenda's staan aan in het weekrooster. null = allemaal.
  calOwners: null,
  // Of het volgende tekenmoment de blokken mag laten binnenkomen.
  entering: false,
  enterTimer: null,
};

const userById = (id) => state.data?.users.find((u) => u.id === id) || null;
const partner = () => state.data?.users.find((u) => u.id !== state.me?.id) || null;

// Eigen kleur voor "samen": geel, duidelijk anders dan het blauw en roze van
// jullie tweeën.
const BOTH_COLOR = '#eab308';

/**
 * Zwarte of witte letters op een gekleurd blok? Geel vraagt om zwart, blauw om
 * wit. Berekend in plaats van per kleur ingesteld, zodat het blijft kloppen als
 * er ooit een kleur bij komt.
 */
function textOn(color) {
  const hex = String(color).replace('#', '');
  if (hex.length !== 6) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#1c1917' : '#ffffff';
}

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
  // Inhoud weggooien: anders blijft het vorige formulier in de pagina staan,
  // met oude waarden en al.
  $('#sheet-body').replaceChildren();
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

function eventForm(existing, presetDate, presetStart) {
  const ev = existing || {};
  const err = errorLine();
  let allDay = Boolean(ev.allDay);
  let repeatFreq = ev.repeat?.freq || 'none';

  // Klik je in het rooster op 14:30, dan staat dat er al in — en een uur later
  // als eindtijd, want dat is verreweg het vaakst goed.
  const startValue = ev.start || presetStart || '09:00';
  const plusHour = (t) => {
    const [hh, mm] = t.split(':').map(Number);
    return `${String(Math.min(23, hh + 1)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  const timeRow = h('div', { class: 'grid-2' },
    field('Van', h('input', { type: 'time', name: 'start', value: startValue, required: true })),
    field('Tot', h('input', {
      type: 'time',
      name: 'end',
      value: ev.end || (presetStart ? plusHour(presetStart) : ''),
    })));

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

  let category = ev.category || 'gewoon';
  const endRow = field('Tot en met',
    h('input', { type: 'date', name: 'endDate', value: ev.endDate || '' }));
  endRow.hidden = category !== 'vakantie';

  const form = h('form', { class: 'form' },
    field('Wat', h('input', { name: 'title', value: ev.title || '', placeholder: 'Bijv. tandarts', required: true, maxlength: '120' })),
    field('Soort', segmented(
      [
        { value: 'gewoon', label: 'Gewoon' },
        { value: 'leuk', label: 'Leuk ding' },
        { value: 'vakantie', label: 'Vakantie' },
      ],
      category,
      (v) => {
        category = v;
        endRow.hidden = v !== 'vakantie';
        // Een vakantie duurt de hele dag; tijden invullen slaat nergens op.
        if (v === 'vakantie' && !allDay) $('input[name=allDay]', form).click();
      },
    )),
    field('Van wie', ownerSelect(ev.ownerId || state.me.id)),
    field('Datum', h('input', { type: 'date', name: 'date', value: ev.date || presetDate || state.data.today, required: true })),
    endRow,
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
    existing && existing.id && h('button', {
      class: 'btn block',
      type: 'button',
      onclick: () => openSheet(ev.title, () => albumSheet(ev, ev.date)),
    }, "Foto's en opmerkingen"),
    h('div', { class: 'form-actions' },
      existing && existing.id && h('button', {
        class: 'btn danger',
        type: 'button',
        onclick: () => confirmSheet('Afspraak verwijderen',
          ev.repeat ? 'Deze afspraak herhaalt zich. De hele reeks wordt verwijderd.'
            : 'De afspraak en de foto\'s die eraan hangen worden verwijderd.',
          () => api(`/events/${ev.id}`, { method: 'DELETE' })),
      }, 'Verwijderen'),
      h('button', { class: 'btn primary', type: 'submit' }, existing?.id ? 'Opslaan' : 'Toevoegen')));

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
      category,
      endDate: category === 'vakantie' ? (values.endDate || null) : null,
      reminderMin: values.reminderMin === '' ? null : Number(values.reminderMin),
      repeat: values.repeatFreq === 'none'
        ? null
        : { freq: values.repeatFreq, interval: 1, until: values.repeatUntil || null },
    };
    if (existing?.id) await api(`/events/${ev.id}`, { method: 'PATCH', body: payload });
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
    !existing?.id && field('Soort', segmented(
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

/**
 * Uitjes en vakanties openen hun album (daar horen de foto's en opmerkingen);
 * een tandartsafspraak opent gewoon het formulier, want daar wil je meestal
 * iets wijzigen en niet terugkijken.
 */
function openEvent(ev) {
  if (ev.category === 'leuk' || ev.category === 'vakantie') {
    return openSheet(ev.title, () => albumSheet(ev, ev.date));
  }
  return openSheet('Afspraak', () => eventForm(ev));
}

function eventRow(ev, onClick) {
  return h('button', { class: 'ev', type: 'button', onclick: onClick },
    h('span', { class: 'ev-time', text: ev.allDay ? 'hele dag' : ev.start }),
    h('span', { class: 'ev-bar', style: { background: ownerColor(ev.ownerId) } }),
    h('span', { class: 'ev-main' },
      h('span', { class: 'ev-title', text: ev.title }),
      h('span', { class: 'ev-sub' },
        [
          ownerName(ev.ownerId),
          ev.dayCount > 1 ? `dag ${ev.dayIndex} van ${ev.dayCount}` : null,
          ev.end && !ev.allDay ? `tot ${ev.end}` : null,
          ev.location,
          ev.repeatLabel,
        ].filter(Boolean).join(' · '))),
    ev.category === 'vakantie' ? h('span', { class: 'chip fun' }, '🌴')
      : ev.category === 'leuk' ? h('span', { class: 'chip fun' }, '✨') : null);
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
      ? h('div', { class: 'day-body' }, ...todays.map((ev) => eventRow(ev, () => openEvent(ev))))
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

// Hoogte van één uur in het rooster. 48 pixels is genoeg om een afspraak van
// een half uur nog leesbaar te houden zonder dat je eindeloos moet scrollen.
const HOUR_PX = 48;
const minsOf = (t) => {
  const [h1, m1] = t.split(':').map(Number);
  return h1 * 60 + m1;
};

/** Wie zijn agenda's kun je aan- en uitzetten, en staan ze aan? */
function calendarOwners() {
  return [...state.data.users.map((u) => u.id), 'both'];
}
const ownerVisible = (id) => !state.calOwners || state.calOwners.has(id);

function toggleOwner(id) {
  const all = calendarOwners();
  const set = new Set(state.calOwners || all);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  state.calOwners = set.size === all.length ? null : set;
  render();
}

/**
 * Legt afspraken die elkaar overlappen naast elkaar, zoals in Google Agenda.
 * Eerst worden ze in trosjes verdeeld (alles wat aan elkaar vastzit), en pas
 * binnen zo'n trosje wordt de breedte verdeeld — anders wordt een afspraak 's
 * ochtends smal omdat er 's avonds twee dingen tegelijk zijn.
 */
function layoutDay(events) {
  const items = events
    .map((ev) => {
      const from = minsOf(ev.start);
      const to = ev.end ? Math.max(minsOf(ev.end), from + 30) : from + 60;
      return { ev, from, to, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.from - b.from || a.to - b.to);

  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    if (!cluster.length) return;
    const ends = [];
    for (const item of cluster) {
      let lane = ends.findIndex((endsAt) => endsAt <= item.from);
      if (lane === -1) {
        lane = ends.length;
        ends.push(item.to);
      } else {
        ends[lane] = item.to;
      }
      item.lane = lane;
    }
    for (const item of cluster) item.lanes = ends.length;
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of items) {
    if (cluster.length && item.from >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.to);
  }
  flush();
  return items;
}

function renderWeek(root) {
  const { today, users, goals } = state.data;
  const start = addDays(weekStart(today), state.weekOffset * 7);
  const days = [...Array(7)].map((unused, i) => addDays(start, i));
  const inWeek = state.data.events.filter((e) => e.date >= days[0] && e.date <= days[6]);

  // ── Kop: welke week, en heen en weer bladeren ──────────────────────────
  root.append(h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('button', {
        class: 'icon-btn ghost',
        type: 'button',
        'aria-label': 'Vorige week',
        onclick: () => { state.weekOffset -= 1; refresh(); },
      }, icon('left')),
      h('div', { style: { textAlign: 'center' } },
        h('h2', { text: state.weekOffset === 0 ? 'Deze week' : `${shortLabel(start)} – ${shortLabel(days[6])}` }),
        h('p', { class: 'muted', text: fmtMonth.format(asDate(start)) })),
      h('button', {
        class: 'icon-btn ghost',
        type: 'button',
        'aria-label': 'Volgende week',
        onclick: () => { state.weekOffset += 1; refresh(); },
      }, icon('right'))),
    h('div', { class: 'card-body' },
      h('div', { class: 'cal-filters' },
        h('button', {
          class: `cal-filter${state.calOwners ? '' : ' is-on'}`,
          type: 'button',
          onclick: () => { state.calOwners = null; render(); },
        }, h('i', { class: 'box', style: { background: 'var(--text-soft)' } }), 'Alles'),
        ...calendarOwners().map((id) => h('button', {
          class: `cal-filter${ownerVisible(id) ? ' is-on' : ''}`,
          type: 'button',
          'aria-pressed': String(ownerVisible(id)),
          onclick: () => toggleOwner(id),
        }, h('i', { class: 'box', style: { background: ownerColor(id) } }), ownerName(id)))),
      state.weekOffset !== 0 && h('button', {
        class: 'btn ghost',
        type: 'button',
        onclick: () => { state.weekOffset = 0; refresh(); },
      }, 'Naar deze week'))));

  // ── Het rooster ────────────────────────────────────────────────────────
  const visible = inWeek.filter((e) => ownerVisible(e.ownerId));
  const cal = h('div', { class: 'cal' });
  const scroller = h('div', { class: 'cal-scroll' }, cal);

  // Kolomkoppen met de dagnaam en het getal.
  const head = h('div', { class: 'cal-row cal-head-row' }, h('div', { class: 'cal-gutter-cell' }));
  for (const date of days) {
    head.append(h('div', { class: `cal-day-head${date === today ? ' is-today' : ''}` },
      h('span', { class: 'cal-dow', text: fmtDow.format(asDate(date)) }),
      h('span', { class: 'cal-dom', text: String(Number(date.slice(8, 10))) })));
  }
  cal.append(head);

  // Strook bovenaan voor hele dagen en vakanties, met één blok over meerdere
  // kolommen — losse blokjes per dag lezen niet als één reis.
  const spanning = new Map();
  for (const occ of visible) {
    if (!occ.allDay && occ.dayCount <= 1) continue;
    const index = days.indexOf(occ.date);
    const found = spanning.get(occ.id);
    if (found) {
      found.last = Math.max(found.last, index);
    } else {
      spanning.set(occ.id, { occ, first: index, last: index });
    }
  }
  if (spanning.size) {
    const strip = h('div', { class: 'cal-row cal-allday' },
      h('div', { class: 'cal-gutter-cell', text: 'hele dag' }));
    const grid = h('div', { class: 'cal-allday-grid' });
    for (const { occ, first, last } of spanning.values()) {
      const color = ownerColor(occ.ownerId);
      grid.append(h('button', {
        class: 'cal-span',
        type: 'button',
        style: {
          gridColumn: `${first + 1} / ${last + 2}`,
          background: color,
          color: textOn(color),
        },
        onclick: () => openEvent(occ),
      }, occ.title));
    }
    strip.append(grid);
    cal.append(strip);
  }

  // De uren zelf.
  const body = h('div', { class: 'cal-row cal-body' });
  const gutter = h('div', { class: 'cal-gutter' });
  for (let hour = 0; hour < 24; hour += 1) {
    gutter.append(h('div', { class: 'cal-hour' },
      hour === 0 ? '' : h('span', { text: `${String(hour).padStart(2, '0')}:00` })));
  }
  body.append(gutter);

  for (const date of days) {
    const column = h('div', {
      class: `cal-col${date === today ? ' is-today' : ''}`,
      style: { height: `${24 * HOUR_PX}px` },
    });

    // Klikken op een leeg stuk maakt meteen een afspraak op dat tijdstip.
    column.addEventListener('click', (e) => {
      if (e.target.closest('.cal-ev')) return;
      const y = e.clientY - column.getBoundingClientRect().top;
      const raw = (y / HOUR_PX) * 60;
      const minutes = Math.max(0, Math.min(23 * 60 + 30, Math.round(raw / 30) * 30));
      const at = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      openSheet('Nieuwe afspraak', () => eventForm(null, date, at));
    });

    const timed = visible.filter((e) => !e.allDay && e.dayCount <= 1 && e.start);
    for (const item of layoutDay(timed.filter((e) => e.date === date))) {
      const { ev, from, to, lane, lanes } = item;
      const color = ownerColor(ev.ownerId);
      const short = to - from < 45;
      column.append(h('button', {
        class: `cal-ev${short ? ' is-short' : ''}`,
        type: 'button',
        style: {
          top: `${(from / 60) * HOUR_PX}px`,
          height: `${Math.max(18, ((to - from) / 60) * HOUR_PX - 2)}px`,
          left: `${(lane / lanes) * 100}%`,
          width: `${(1 / lanes) * 100}%`,
          background: color,
          color: textOn(color),
        },
        onclick: () => openEvent(ev),
      },
      h('span', { class: 'cal-ev-title', text: ev.title }),
      !short && h('span', { class: 'cal-ev-time', text: ev.start })));
    }

    if (date === today) {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      column.append(h('div', { class: 'cal-now', style: { top: `${(nowMin / 60) * HOUR_PX}px` } }));
    }
    body.append(column);
  }
  cal.append(body);
  root.append(scroller);

  // Bij het openen niet om middernacht beginnen maar rond het ontbijt.
  requestAnimationFrame(() => {
    const target = state.weekOffset === 0
      ? Math.max(0, (new Date().getHours() - 2) * HOUR_PX)
      : 7 * HOUR_PX;
    scroller.scrollTop = target;
  });

  // ── Hoe staan de doelen er deze week voor ──────────────────────────────
  const habits = goals.filter((g) => !g.archived && g.kind === 'habit');
  if (habits.length) {
    const inner = h('div', { class: 'card-body' });
    for (const owner of calendarOwners()) {
      const mine = habits.filter((g) => g.ownerId === owner);
      if (!mine.length) continue;
      inner.append(h('div', {},
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
    root.append(card('Doelen deze week', null, inner));
  }
}

// ── Album: foto's en opmerkingen bij een uitje of vakantie ─────────────────

/**
 * Het album van één moment. Alles wat hier gebeurt (foto erbij, opmerking,
 * verwijderen) tekent meteen opnieuw, zodat je niet hoeft te raden of het is
 * aangekomen.
 */
function albumSheet(event, occurrenceDate) {
  const date = albumDate(event, occurrenceDate);
  const wrap = h('div', { class: 'form' });

  const draw = () => {
    const photos = (state.data.photos || [])
      .filter((p) => p.eventId === event.id && p.date === date)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const comments = (event.comments || [])
      .filter((c) => c.date === date)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const cd = countdown(event.date, event.endDate, state.data.today);

    const head = h('div', { class: 'album-head' },
      h('span', { class: `count ${cd.past ? 'past' : cd.now ? 'now' : 'soon'}`, text: cd.label }),
      h('p', { class: 'muted', text: [
        event.endDate ? `${shortLabel(event.date)} t/m ${shortLabel(event.endDate)}` : dayLabel(event.date),
        !event.allDay && event.start ? event.start : null,
        event.location,
        ownerName(event.ownerId),
      ].filter(Boolean).join(' · ') }));

    const grid = photos.length
      ? h('div', { class: 'photo-grid' }, ...photos.map((photo) => h('button', {
        class: 'photo',
        type: 'button',
        'aria-label': photo.caption || 'Foto bekijken',
        onclick: () => viewPhoto(photo, event, date),
      }, h('img', { src: `/api/photos/${photo.id}`, alt: photo.caption || '', loading: 'lazy' }))))
      : emptyNote('Nog geen foto\'s. Voeg de eerste toe.', 'camera');

    const addPhoto = h('button', { class: 'btn block primary', type: 'button' },
      icon('camera'), 'Foto toevoegen');
    addPhoto.addEventListener('click', () => pickPhotos(event, date, addPhoto, draw));

    const commentList = comments.length
      ? h('div', { class: 'comments' }, ...comments.map((c) => h('div', { class: 'comment' },
        h('div', { class: 'comment-head' },
          h('i', { class: 'dot', style: { background: ownerColor(c.userId) } }),
          h('strong', { text: ownerName(c.userId) }),
          h('span', { class: 'muted', text: shortLabel(c.createdAt.slice(0, 10)) }),
          c.userId === state.me.id && h('button', {
            class: 'icon-btn ghost small',
            type: 'button',
            'aria-label': 'Opmerking verwijderen',
            onclick: async () => {
              await api(`/events/${event.id}/comments/${c.id}`, { method: 'DELETE' });
              event.comments = event.comments.filter((x) => x.id !== c.id);
              draw();
              refresh();
            },
          }, icon('trash'))),
        h('p', { text: c.text }))))
      : h('p', { class: 'muted', text: 'Nog geen opmerkingen.' });

    const input = h('textarea', {
      name: 'text',
      maxlength: '1000',
      rows: '2',
      placeholder: 'Wat wil je hierover onthouden?',
    });
    const commentForm = h('form', { class: 'comment-form' },
      input,
      h('button', { class: 'btn primary', type: 'submit' }, 'Plaats'));

    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      try {
        const res = await api(`/events/${event.id}/comments`, {
          method: 'POST',
          body: { text, date },
        });
        event.comments = [...(event.comments || []), res.comment];
        draw();
        refresh();
      } catch (err) {
        toast(err.message);
      }
    });

    // replaceChildren() maakt van een null netjes de tekst "null"; anders dan
    // h() slaat het niets over. Dus eerst zelf de lege plekken eruit.
    wrap.replaceChildren(...[
      head,
      event.notes && h('p', { class: 'muted', text: event.notes }),
      grid,
      addPhoto,
      h('h3', { class: 'album-sub', text: `Opmerkingen${comments.length ? ` · ${comments.length}` : ''}` }),
      commentList,
      commentForm,
      h('button', {
        class: 'btn block',
        type: 'button',
        onclick: () => openSheet('Afspraak aanpassen', () => eventForm(event)),
      }, 'Gegevens aanpassen'),
    ].filter(Boolean));
  };

  draw();
  return wrap;
}

/** Kiest foto's, verkleint ze en stuurt ze een voor een op. */
function pickPhotos(event, date, button, done) {
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true });
  input.addEventListener('change', async () => {
    const files = [...(input.files || [])];
    if (!files.length) return;
    button.disabled = true;
    let ok = 0;
    for (const [i, file] of files.entries()) {
      button.textContent = `Bezig… ${i + 1} van ${files.length}`;
      try {
        const dataUrl = await shrinkImage(file);
        const res = await api(`/events/${event.id}/photos`, {
          method: 'POST',
          body: { dataUrl, date },
        });
        state.data.photos = [...(state.data.photos || []), res.photo];
        ok += 1;
      } catch (err) {
        toast(err.message);
      }
    }
    button.disabled = false;
    if (ok) toast(ok === 1 ? 'Foto toegevoegd.' : `${ok} foto's toegevoegd.`);
    done();
    refresh();
  });
  input.click();
}

/** Eén foto groot, met de mogelijkheid hem weg te halen. */
function viewPhoto(photo, event, date) {
  openSheet('Foto', () => h('div', { class: 'form' },
    h('img', { class: 'photo-large', src: `/api/photos/${photo.id}`, alt: photo.caption || '' }),
    h('p', { class: 'muted', text: `Geplaatst door ${ownerName(photo.userId)} · ${shortLabel(photo.createdAt.slice(0, 10))}` }),
    h('div', { class: 'form-actions' },
      h('button', {
        class: 'btn',
        type: 'button',
        onclick: () => openSheet(event.title, () => albumSheet(event, date)),
      }, 'Terug'),
      h('button', {
        class: 'btn danger',
        type: 'button',
        onclick: async () => {
          try {
            await api(`/photos/${photo.id}`, { method: 'DELETE' });
            state.data.photos = state.data.photos.filter((p) => p.id !== photo.id);
            toast('Foto verwijderd.');
            openSheet(event.title, () => albumSheet(event, date));
            refresh();
          } catch (err) {
            toast(err.message);
          }
        },
      }, 'Verwijderen'))));
}

// ── Scherm: Momenten ───────────────────────────────────────────────────────

function momentCard(item) {
  const cd = countdown(item.date, item.endDate, state.moments.today);
  const cover = (state.data.photos || []).find((p) => p.eventId === item.id);
  return h('button', {
    class: 'moment',
    type: 'button',
    onclick: () => openSheet(item.title, () => albumSheet(item, item.date)),
  },
  cover
    ? h('img', { class: 'moment-cover', src: `/api/photos/${cover.id}`, alt: '', loading: 'lazy' })
    : h('span', { class: 'moment-cover placeholder' },
      icon(item.category === 'vakantie' ? 'sparkle' : 'heart')),
  h('span', { class: 'moment-main' },
    h('span', { class: 'moment-title', text: item.title }),
    h('span', { class: 'row-sub', text: [
      item.endDate ? `${shortLabel(item.date)} t/m ${shortLabel(item.endDate)}` : dayLabel(item.date),
      item.location,
      ownerName(item.ownerId),
    ].filter(Boolean).join(' · ') }),
    h('span', { class: 'moment-meta' },
      h('span', { class: `count ${cd.past ? 'past' : cd.now ? 'now' : cd.soon ? 'soon' : ''}`, text: cd.label }),
      item.photoCount ? h('span', { class: 'chip' }, icon('camera'), String(item.photoCount)) : null,
      item.commentCount ? h('span', { class: 'chip' }, icon('comment'), String(item.commentCount)) : null)));
}

function renderMomenten(root) {
  if (!state.moments) {
    root.append(h('div', { class: 'card' }, h('div', { class: 'spinner' })));
    return;
  }
  const { upcoming, past } = state.moments;

  root.append(h('div', { class: 'card' }, h('div', { class: 'card-body' },
    segmented(
      [
        { value: 'komt', label: `Komt eraan · ${upcoming.length}` },
        { value: 'geweest', label: `Geweest · ${past.length}` },
      ],
      state.momentFilter,
      (v) => { state.momentFilter = v; render(); },
    ))));

  const list = state.momentFilter === 'komt' ? upcoming : past;

  if (!list.length) {
    root.append(card(state.momentFilter === 'komt' ? 'Komt eraan' : 'Geweest',
      h('button', {
        class: 'btn ghost',
        type: 'button',
        onclick: () => openSheet('Nieuw leuk ding', () => eventForm({ category: 'leuk' }, state.data.today)),
      }, '+ Plannen'),
      emptyNote(state.momentFilter === 'komt'
        ? 'Nog niets gepland. Zet iets leuks in de agenda en zet het op "Leuk ding" of "Vakantie".'
        : 'Hier komen jullie uitjes en vakanties te staan zodra ze geweest zijn.', 'heart')));
    return;
  }

  root.append(h('div', { class: 'moments' }, ...list.map(momentCard)));

  if (state.momentFilter === 'komt') {
    root.append(h('button', {
      class: 'btn block',
      type: 'button',
      onclick: () => openSheet('Nieuw leuk ding', () => eventForm({ category: 'leuk' }, state.data.today)),
    }, '+ Iets leuks plannen'));
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
  momenten: 'Momenten',
  doelen: 'Doelen',
  taken: 'Taken',
  meer: 'Meer',
};

const RENDERERS = {
  vandaag: renderVandaag,
  week: renderWeek,
  momenten: renderMomenten,
  doelen: renderDoelen,
  taken: renderTaken,
  meer: renderMeer,
};

/**
 * Laat de blokken van een scherm één voor één binnenkomen. De vertraging per
 * blok staat in CSS; hier geven we alleen door de hoeveelste het is. Na afloop
 * gaat de klasse er weer af, anders zou elke verversing opnieuw animeren —
 * en dan springt de lijst op zodra je een taak afvinkt.
 */
function animateIn(root) {
  root.classList.remove('is-entering');
  [...root.children].forEach((el, i) => el.style.setProperty('--i', String(Math.min(i, 8))));
  void root.offsetWidth; // forceer een herstart van de animatie
  root.classList.add('is-entering');
  clearTimeout(state.enterTimer);
  state.enterTimer = setTimeout(() => root.classList.remove('is-entering'), 1000);
}

function setTab(tab) {
  state.tab = tab;
  state.entering = true;
  $$('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== tab; });
  $('#view-title').textContent = TITLES[tab];
  const url = new URL(location.href);
  url.searchParams.set('tab', tab);
  history.replaceState(null, '', url);
  render();
}

$$('.tab').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

// Zodra je scrolt maakt de bovenbalk zich klein en komt hij los van de pagina.
// De klasse gaat er maar één keer op of af, dus dit kost tijdens het scrollen
// vrijwel niets.
{
  const topbar = $('.topbar');
  let stuck = false;
  addEventListener('scroll', () => {
    const next = scrollY > 10;
    if (next !== stuck) {
      stuck = next;
      topbar.classList.toggle('is-stuck', next);
    }
  }, { passive: true });
}

$('#add-btn').addEventListener('click', () => {
  if (state.tab === 'momenten') {
    return openSheet('Nieuw leuk ding', () => eventForm({ category: 'leuk' }, state.data.today));
  }
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
  if (state.entering) {
    state.entering = false;
    animateIn(root);
  }

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
  const [data, moments] = await Promise.all([
    api(`/state?from=${from}&to=${to}`),
    api('/moments'),
  ]);
  state.data = data;
  state.moments = moments;
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
