import 'dotenv/config';

/**
 * Setup doctor: controleert je .env en zegt precies wat klopt of mist.
 *
 *   npm run check            (offline controles)
 *   npm run check -- --live  (test je Anthropic-key ook echt)
 */

const live = process.argv.includes('--live');
let problems = 0;

const ok = (m) => console.log(`  ✅ ${m}`);
const warn = (m) => console.log(`  ⚠️  ${m}`);
const bad = (m) => {
  console.log(`  ❌ ${m}`);
  problems++;
};

console.log('\n🔧 Verplichte instellingen');

const key = process.env.ANTHROPIC_API_KEY;
if (!key) bad('ANTHROPIC_API_KEY ontbreekt');
else if (!key.startsWith('sk-ant-')) bad('ANTHROPIC_API_KEY ziet er ongeldig uit (verwacht begin "sk-ant-")');
else ok('ANTHROPIC_API_KEY aanwezig');

const pin = process.env.APP_PIN;
if (!pin) bad('APP_PIN ontbreekt (kies 4-6 cijfers, bv. APP_PIN=4821)');
else if (!/^\d{4,6}$/.test(pin)) bad('APP_PIN moet 4 tot 6 cijfers zijn');
else if (['1234', '0000', '1111', '123456', '000000'].includes(pin))
  warn('APP_PIN is wel érg makkelijk te raden');
else ok('APP_PIN aanwezig');

const port = process.env.PORT || '3000';
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) bad('PORT is ongeldig');
else ok(`PORT: ${port}`);

if (live && key) {
  console.log('\n🌐 Live Anthropic-check');
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: key });
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
    ? '\n🎉 Alles ziet er goed uit. Start met: npm start (of dubbelklik start-coach.bat)\n'
    : `\n⛔ ${problems} probleem(en) gevonden — fix die en draai opnieuw.\n`,
);
process.exit(problems === 0 ? 0 : 1);
