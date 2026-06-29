import Anthropic from '@anthropic-ai/sdk';
import { config, ASSISTANT_PERSONA } from './config.js';
import { activeToolDefs, handlers } from './tools.js';
import { buildContextSummary } from './db.js';

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

const MAX_STEPS = 8;

function systemPrompt() {
  const today = new Date().toLocaleString('nl-NL', {
    timeZone: config.coach.timezone,
  });
  return [
    ASSISTANT_PERSONA,
    `\nHuidige datum/tijd: ${today} (${config.coach.timezone}).`,
    '\n' + buildContextSummary(),
  ].join('\n');
}

async function runHandler(name, input) {
  const handler = handlers[name];
  if (!handler) return `Onbekende tool: ${name}`;
  try {
    return await handler(input || {});
  } catch (err) {
    return `Fout bij ${name}: ${err.message}`;
  }
}

/**
 * Run an agentic turn: send the conversation, execute any tools Claude calls,
 * and loop until it produces a final text answer.
 *
 * @param {Array<{role:'user'|'assistant', content:any}>} messages
 * @param {{model?: string}} [opts]
 * @returns {Promise<string>}
 */
export async function runAgent(messages, opts = {}) {
  const tools = [...activeToolDefs()];
  if (config.anthropic.webSearch) {
    tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 3 });
  }

  const convo = [...messages];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.messages.create({
      model: opts.model || config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      system: systemPrompt(),
      tools,
      messages: convo,
    });

    // Server tools (web_search) may pause the turn; resume by resending.
    if (response.stop_reason === 'pause_turn') {
      convo.push({ role: 'assistant', content: response.content });
      continue;
    }

    if (response.stop_reason === 'tool_use') {
      convo.push({ role: 'assistant', content: response.content });
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const result = await runHandler(block.name, block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: String(result),
        });
      }
      convo.push({ role: 'user', content: toolResults });
      continue;
    }

    // Final answer.
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  }

  return 'Ik liep vast in te veel stappen — kun je je verzoek iets opsplitsen?';
}
