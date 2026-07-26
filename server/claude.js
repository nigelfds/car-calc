import Anthropic from '@anthropic-ai/sdk';

// Model per job, not one model for everything.
// HAIKU: structured extraction — narrow, well-specified, high volume, cheap.
//        Only reached when the browser's on-device Prompt API is unavailable.
// SONNET: the explanation — the one job that genuinely needs reasoning.
export const MODELS = {
  parse: 'claude-haiku-4-5-20251001',
  explain: 'claude-sonnet-5'
};

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export const aiEnabled = () => client !== null;

/**
 * Calls Claude and returns the validated tool input, or null on any failure.
 * Never throws — every caller has a working fallback path.
 */
export async function askClaude({ model, system, messages, tool, schema, timeoutMs = 10000 }) {
  if (!client) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name }
    }, { signal: controller.signal });

    const block = response.content.find(c => c.type === 'tool_use');
    if (!block) return null;

    const validated = schema.safeParse(block.input);
    return validated.success ? validated.data : null;
  } catch (error) {
    console.warn(`Claude call failed: ${error.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
