import 'dotenv/config';

/**
 * Setup doctor: checks your .env and tells you exactly what is OK, missing, or
 * malformed — so you don't have to guess why something doesn't start.
 *
 *   npm run check          (offline format checks + live Slack token check)
 *   npm run check -- --live  (also verifies your Anthropic key with a tiny call)
 */

const live = process.argv.includes('--live');
let problems = 0;

const ok = (m) => console.log(`  ✅ ${m}`);
const warn = (m) => console.log(`  ⚠️  ${m}`);
const bad = (m) => {
  console.log(`  ❌ ${m}`);
  problems++;
};

function checkFormat(name, prefix, { required = true } = {}) {
  const v = process.env[name];
  if (!v) {
    required ? bad(`${name} ontbreekt`) : warn(`${name} niet gezet (optioneel)`);
    return false;
  }
  if (prefix && !v.startsWith(prefix)) {
    bad(`${name} ziet er ongeldig uit (verwacht begin "${prefix}")`);
    return false;
  }
  ok(`${name} aanwezig`);
  return true;
}

console.log('\n🔧 Verplichte instellingen');
const hasBot = checkFormat('SLACK_BOT_TOKEN', 'xoxb-');
checkFormat('SLACK_APP_TOKEN', 'xapp-');
checkFormat('ANTHROPIC_API_KEY', 'sk-ant-');

const coach = process.env.SLACK_COACH_CHANNEL;
if (!coach) warn('SLACK_COACH_CHANNEL niet gezet → proactieve check-ins staan uit');
else if (!/^[CD]/.test(coach)) warn('SLACK_COACH_CHANNEL begint normaal met C of D');
else ok('SLACK_COACH_CHANNEL aanwezig');

console.log('\n🔧 Google (optioneel)');
const g = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
const gSet = g.filter((n) => process.env[n]);
if (gSet.length === 0) warn('Google-koppeling uit (agenda/mail-tools verborgen)');
else if (gSet.length === 3) ok('Google volledig geconfigureerd');
else bad(`Google half ingevuld: mist ${g.filter((n) => !process.env[n]).join(', ')}`);

// --- Live checks ---
if (hasBot) {
  console.log('\n🌐 Live Slack-check');
  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    });
    const data = await res.json();
    if (data.ok) ok(`Slack-token werkt → @${data.user} in workspace "${data.team}"`);
    else bad(`Slack-token afgewezen: ${data.error}`);
  } catch (err) {
    bad(`Kon Slack niet bereiken: ${err.message}`);
  }
}

if (live && process.env.ANTHROPIC_API_KEY) {
  console.log('\n🌐 Live Anthropic-check');
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 4,
      messages: [{ role: 'user', content: 'zeg ok' }],
    });
    ok('Anthropic-key werkt');
  } catch (err) {
    bad(`Anthropic-key probleem: ${err.message}`);
  }
}

console.log(
  problems === 0
    ? '\n🎉 Alles ziet er goed uit. Start met: npm start\n'
    : `\n⛔ ${problems} probleem(en) gevonden — fix die en draai opnieuw.\n`,
);
process.exit(problems === 0 ? 0 : 1);
