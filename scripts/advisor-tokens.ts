/** Measures the advisor's cached prefix (system prompt + tools) with the real tokenizer. */
import Anthropic from "@anthropic-ai/sdk";
import { buildSystem } from "../lib/advisor/prompt";
import { TOOLS } from "../lib/advisor/tools";

async function main() {
const client = new Anthropic();
const res = await client.messages.countTokens({
  model: "claude-haiku-5-5",
  system: buildSystem(),
  tools: TOOLS,
  messages: [{ role: "user", content: "Hello" }],
});
console.log(`advisor prefix: ${res.input_tokens} tokens (must stay well under 100,000)`);
}
main();
