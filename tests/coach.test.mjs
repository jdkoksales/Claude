import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCoachReply, generateCard, FALLBACK_CARD, SYSTEM_PROMPT, ACTION_TYPES,
} from '../src/coach.js';
import { detectTrigger, buildCoachPayload } from '../src/lib/insights.js';

test('parser: schoon JSON-antwoord', () => {
  const out = parseCoachReply(
    '{"bericht":"Wat fijn dat je er weer bent!","acties":[{"label":"Halveer minimum","type":"verklein_minimum"}]}',
  );
  assert.equal(out.bericht, 'Wat fijn dat je er weer bent!');
  assert.deepEqual(out.acties, [{ label: 'Halveer minimum', type: 'verklein_minimum' }]);
});

test('parser: markdown-fences en pre-tekst worden gestript', () => {
  const out = parseCoachReply(
    'Hier is het antwoord:\n```json\n{"bericht":"Top!","acties":[{"label":"Laat zo","type":"laat_zo"}]}\n```',
  );
  assert.equal(out.bericht, 'Top!');
});

test('parser: onbekende actietypes worden weggefilterd, nooit lege lijst', () => {
  const out = parseCoachReply(
    '{"bericht":"Ok","acties":[{"label":"Hack","type":"rm_rf"},{"label":"Pauzeer","type":"pauzeer_doel"}]}',
  );
  assert.deepEqual(out.acties, [{ label: 'Pauzeer', type: 'pauzeer_doel' }]);
  const none = parseCoachReply('{"bericht":"Ok","acties":[{"label":"X","type":"nep"}]}');
  assert.deepEqual(none.acties, [{ label: 'Laat zo', type: 'laat_zo' }]);
});

test('parser: max 3 acties', () => {
  const four = ACTION_TYPES.concat('laat_zo').map((t, i) => `{"label":"A${i}","type":"${t}"}`).join(',');
  const out = parseCoachReply(`{"bericht":"Ok","acties":[${four}]}`);
  assert.equal(out.acties.length, 3);
});

test('parser: kapotte antwoorden gooien (→ fallbackpad)', () => {
  for (const broken of ['', 'geen json', '{"acties":[]}', '{"bericht":""}', '{"bericht":123}', '{bericht:', null]) {
    assert.throws(() => parseCoachReply(broken), undefined, `hoort te gooien op: ${broken}`);
  }
  assert.throws(() => parseCoachReply(`{"bericht":"${'x'.repeat(500)}"}`), /ongeldig/);
});

test('systeemprompt bevat de verplichte strekking', () => {
  for (const frag of ['week 2-3', 'NIET meer nodig', 'nooit schuld', 'verklein het minimum', 'comebacks', '2 zinnen', 'mensen om de gebruiker heen', 'uitsluitend als JSON']) {
    assert.ok(SYSTEM_PROMPT.includes(frag), `mist: ${frag}`);
  }
});

// ─── Integratie: gesimuleerde 14-daagse drift-dataset ───
function driftScenario() {
  const logs = [
    // Week 1: keurig targets
    { goal_id: 1, day: '2026-07-01', level: 'target' },
    { goal_id: 1, day: '2026-07-02', level: 'target' },
    { goal_id: 1, day: '2026-07-04', level: 'target' },
    { goal_id: 1, day: '2026-07-06', level: 'target' },
    // Week 2: zakt af naar minimums
    { goal_id: 1, day: '2026-07-08', level: 'minimum' },
    { goal_id: 1, day: '2026-07-10', level: 'minimum' },
    { goal_id: 1, day: '2026-07-12', level: 'target' },
    { goal_id: 1, day: '2026-07-13', level: 'minimum' },
  ];
  const goals = [{ id: 1, action: 'sporten', minimum: '2 min bewegen', target: 'volledige work-out' }];
  return { logs, goals, today: '2026-07-14' };
}

test('drift-dataset: check gaat af en de call vertrekt met valide payload', async () => {
  const { logs, goals, today } = driftScenario();
  const trigger = detectTrigger(logs, goals, today);
  assert.equal(trigger.type, 'drift');

  let sentRequest = null;
  const card = await generateCard(
    buildCoachPayload({ trigger, goals, logs, today, lastReview: null }),
    {
      createMessage: async (req) => {
        sentRequest = req;
        return {
          content: [{ type: 'text', text: '{"bericht":"Je minimum is genoeg deze week.","acties":[{"label":"Verklein minimum","type":"verklein_minimum"},{"label":"Laat zo","type":"laat_zo"}]}' }],
        };
      },
    },
  );

  // De call vertrok met systeemprompt + JSON-payload
  assert.ok(sentRequest, 'API-call is niet vertrokken');
  assert.equal(sentRequest.system, SYSTEM_PROMPT);
  const payload = JSON.parse(sentRequest.messages[0].content);
  assert.equal(payload.trigger.type, 'drift');
  assert.equal(payload.doelen[0].laatste_14_dagen.length, 8);
  // En het antwoord parseert
  assert.equal(card.fallback, false);
  assert.equal(card.acties.length, 2);
});

test('kapot antwoord geïnjecteerd → statische fallback, geen crash', async () => {
  const { logs, goals, today } = driftScenario();
  const payload = buildCoachPayload({ trigger: { type: 'drift', goalId: 1 }, goals, logs, today });

  const broken = await generateCard(payload, {
    createMessage: async () => ({ content: [{ type: 'text', text: 'Sorry, hier is wat proza zonder JSON.' }] }),
  });
  assert.equal(broken.fallback, true);
  assert.equal(broken.bericht, FALLBACK_CARD.bericht);

  const apiDown = await generateCard(payload, {
    createMessage: async () => { throw new Error('530 upstream'); },
  });
  assert.equal(apiDown.fallback, true);
});
