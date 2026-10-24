// Prints an interviewer prompt as plain text for pasting into the ElevenLabs dashboard.
// Usage: npm run prompt -- consulting
import * as consulting from "../src/lib/prompts/interviewer-consulting.ts";

const prompts: Record<string, { firstMessage: string; systemPrompt: string }> = {
  consulting,
};

const track = process.argv[2] ?? "consulting";
const prompt = prompts[track];
if (!prompt) {
  console.error(`Unbekannter Track "${track}". Verfügbar: ${Object.keys(prompts).join(", ")}`);
  process.exit(1);
}

console.log("===== First message =====\n");
console.log(prompt.firstMessage);
console.log("\n===== System prompt =====\n");
console.log(prompt.systemPrompt);
