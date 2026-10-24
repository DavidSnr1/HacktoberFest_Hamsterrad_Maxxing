// Runs the real interview evaluation (Gemma via src/lib/llm.ts) on a sample
// transcript and prints the result. Nothing is stored.
// Usage: npm run feedback:try [-- path/to/transcript.json [track]]
import { readFileSync } from "node:fs";
import { evaluateTranscript } from "@/lib/interview/feedback";
import { trackSchema, transcriptSchema } from "@/lib/schemas/interview";

const file = process.argv[2] ?? "scripts/fixtures/consulting-transcript.json";
const track = trackSchema.parse(process.argv[3] ?? "consulting");
const transcript = transcriptSchema.parse(JSON.parse(readFileSync(file, "utf8")));
const durationSeconds = transcript.at(-1)?.at ?? null;

const started = Date.now();
const { scores, feedback, usage } = await evaluateTranscript({ track, transcript, durationSeconds });

console.log(`Gesamt: ${scores.overall ?? "–"} / 5   (Raster ${scores.rubricVersion}, ${scores.model})\n`);
for (const c of scores.criteria) {
  console.log(`${c.title}: ${c.score ?? "nicht bewertbar"}`);
  console.log(`  ${c.reasoning}`);
  if (c.quote) console.log(`  Zitat: „${c.quote}“`);
}
console.log("\nStärken:");
feedback.strengths.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
console.log("\nVerbesserungen:");
feedback.improvements.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
console.log(`\nÜbung: ${feedback.exercise}`);
console.log(`\nZusammenfassung: ${feedback.summary}`);
console.log(
  `\n${((Date.now() - started) / 1000).toFixed(1)} s · ${usage.length} Aufruf(e) · ` +
    usage.map((u) => `in=${u.inputTokens} out=${u.outputTokens}`).join(" | "),
);
