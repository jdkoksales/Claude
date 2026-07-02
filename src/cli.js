import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { assertEnv, config } from './config.js';
import { runAgent } from './claude.js';

/**
 * Terminal version of the assistant. Lets you try everything (tasks, goals,
 * web search, coaching) with ONLY an Anthropic API key. It shares the same
 * memory file as the web app, so anything you add here shows up there too.
 *
 *   npm run chat
 */

assertEnv(['ANTHROPIC_API_KEY']);

console.log('💬 Assistent in de terminal. Type je bericht en druk Enter.');
console.log(`   Model: ${config.anthropic.model} | Typ "exit" om te stoppen.\n`);

const rl = readline.createInterface({ input, output });
const history = [];

while (true) {
  const text = (await rl.question('jij › ')).trim();
  if (!text) continue;
  if (['exit', 'quit', 'stop'].includes(text.toLowerCase())) break;

  history.push({ role: 'user', content: text });
  try {
    const reply = await runAgent(history);
    history.push({ role: 'assistant', content: reply });
    console.log(`\nassistent › ${reply}\n`);
  } catch (err) {
    console.error(`\n⚠️  Fout: ${err.message}\n`);
    history.pop();
  }
}

rl.close();
console.log('Tot ziens! 👋');
