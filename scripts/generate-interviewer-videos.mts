// Renders the talking-head clips of an interviewer with D-ID and stores them in
// Supabase Storage: one MP4 per spoken line plus the MP3 it was lip-synced to.
// Lines that already have a clip are skipped (use --force after a photo change).
// Usage: npm run videos:generate -- --track consulting --photo private/lena.jpg [--force]
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { parseArgs } from "node:util";
import { renderTalk, uploadAudio, uploadImage } from "@/lib/did";
import { synthesizeSpeech } from "@/lib/elevenlabs";
import { clipPath, INTERVIEWER_VIDEO_BUCKET, speechLines } from "@/lib/interview/interviewer-video";
import { trackSchema } from "@/lib/schemas/interview";
import { createAdminClient } from "@/lib/supabase/admin";

const PHOTO_TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const { values } = parseArgs({
  options: {
    track: { type: "string" },
    photo: { type: "string" },
    force: { type: "boolean", default: false },
  },
});

const track = trackSchema.parse(values.track);
const photoPath = values.photo;
if (!photoPath) throw new Error("--photo is required (JPG or PNG)");
const photoType = PHOTO_TYPES[extname(photoPath).toLowerCase()];
if (!photoType) throw new Error("The photo must be a .jpg, .jpeg or .png file");
if (!existsSync(photoPath)) throw new Error(`Photo not found: ${photoPath}`);
if (statSync(photoPath).size > MAX_PHOTO_BYTES) throw new Error("The photo must be smaller than 10 MB");

if (!process.env.DID_API_KEY?.trim()) throw new Error("DID_API_KEY is missing in .env.local");
if (!process.env.ELEVENLABS_API_KEY?.trim()) throw new Error("ELEVENLABS_API_KEY is missing in .env.local");

const lines = speechLines(track);
if (lines.length === 0) throw new Error(`Track ${track} has no question script yet`);

const admin = createAdminClient();
if (!admin) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
const storage = admin.storage;

if ((await storage.getBucket(INTERVIEWER_VIDEO_BUCKET)).error) {
  const { error } = await storage.createBucket(INTERVIEWER_VIDEO_BUCKET, {
    public: false,
    allowedMimeTypes: ["video/mp4", "audio/mpeg"],
    fileSizeLimit: "50MB",
  });
  if (error) throw new Error(`Could not create bucket: ${error.message}`);
  console.log(`Bucket "${INTERVIEWER_VIDEO_BUCKET}" angelegt (privat).`);
}

const { data: existing } = await storage.from(INTERVIEWER_VIDEO_BUCKET).list(track, { limit: 1000 });
const existingNames = new Set((existing ?? []).map((file) => file.name));

const imageUrl = await uploadImage(new Blob([readFileSync(photoPath)], { type: photoType }), basename(photoPath));
console.log(`Foto hochgeladen. ${lines.length} Zeilen für Track "${track}":\n`);

let rendered = 0;
for (const [index, line] of lines.entries()) {
  const path = clipPath(track, line.text);
  const name = path.slice(track.length + 1);
  const label = `[${index + 1}/${lines.length}] ${line.item}`;
  if (!values.force && existingNames.has(`${name}.mp4`) && existingNames.has(`${name}.mp3`)) {
    console.log(`${label}: vorhanden, übersprungen`);
    continue;
  }

  const started = Date.now();
  const audio = await synthesizeSpeech(line.text);
  const audioUrl = await uploadAudio(new Blob([audio], { type: "audio/mpeg" }), `${name}.mp3`);
  const video = await renderTalk(imageUrl, audioUrl);

  // Upload the MP3 last: a line counts as done only when both files exist.
  for (const [ext, body, contentType] of [
    ["mp4", video, "video/mp4"],
    ["mp3", audio, "audio/mpeg"],
  ] as const) {
    const { error } = await storage
      .from(INTERVIEWER_VIDEO_BUCKET)
      .upload(`${path}.${ext}`, body, { contentType, upsert: true });
    if (error) throw new Error(`Upload of ${line.item} (${ext}) failed: ${error.message}`);
  }
  rendered++;
  console.log(`${label}: fertig (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}

console.log(`\n${rendered} Clip(s) erzeugt. Interview neu laden, um sie zu sehen.`);
