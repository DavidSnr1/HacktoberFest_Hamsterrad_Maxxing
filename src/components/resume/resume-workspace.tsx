"use client";

import { DownloadIcon, Loader2Icon, PencilIcon, RefreshCwIcon, SendIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ResumeChange } from "@/lib/resume/diff";
import { TRACK_TEMPLATES } from "@/lib/resume/tracks";
import type { Resume, ResumeLanguage, ResumeTrack } from "@/lib/schemas/resume";

import { ChangeReview } from "./change-review";
import { LlmProgress } from "./llm-progress";
import { decideDraft, deleteResume, exportUrl, generateResume, reviseResume, updateResume } from "./resume-api";
import { useResumeConsent } from "./resume-consent";
import { ResumePreview } from "./resume-preview";

type WorkspaceVersion = {
  version: number;
  status: "draft" | "accepted" | "rejected";
  instruction: string | null;
  notes: string | null;
  createdAt: string;
  content: Resume;
};

type Props = {
  id: string;
  track: ResumeTrack;
  targetRole: string;
  language: ResumeLanguage;
  activeVersion: number;
  versions: WorkspaceVersion[];
  draft: { version: number; note: string | null; changes: ResumeChange[] } | null;
  /** Result of `hasConsent("resume")` on the server. */
  consentGranted: boolean;
  /** The profile changed after the active version was created. */
  outdated?: boolean;
};

const SUGGESTIONS = [
  "Kürzer fassen, maximal eine Seite",
  "Quantitative Erfolge stärker betonen",
  "Zusammenfassung prägnanter formulieren",
  "Weniger relevante Stationen weglassen",
];

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" });

export function ResumeWorkspace({
  id,
  track,
  targetRole,
  language,
  activeVersion,
  versions,
  draft,
  consentGranted,
  outdated = false,
}: Props) {
  const router = useRouter();
  const { requireConsent, consentDialog } = useResumeConsent(consentGranted);
  const accepted = versions.filter((v) => v.status === "accepted");
  const [selected, setSelected] = useState(activeVersion);
  const shown = accepted.find((v) => v.version === selected) ?? accepted.find((v) => v.version === activeVersion);

  const [instruction, setInstruction] = useState("");
  const [roleDraft, setRoleDraft] = useState<string | null>(null);
  const [pending, setPending] = useState<"revise" | "decide" | "activate" | "delete" | "role" | "rebuild" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function run(kind: NonNullable<typeof pending>, action: () => Promise<void>) {
    setPending(kind);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Etwas ist schiefgelaufen.");
    } finally {
      setPending(null);
    }
  }

  function submitInstruction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = instruction.trim();
    if (text.length < 3) return;
    requireConsent(
      () =>
        void run("revise", async () => {
          const result = await reviseResume(id, text);
          setInstruction("");
          if (result.version === null) setInfo(result.note);
          router.refresh();
        }),
    );
  }

  async function onDecide(acceptedChangeIds: string[]) {
    await run("decide", async () => {
      await decideDraft(id, draft?.version ?? 0, acceptedChangeIds);
      router.refresh();
    });
  }

  function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const role = roleDraft?.trim() ?? "";
    if (role.length < 3) return;
    void run("role", async () => {
      await updateResume(id, { targetRole: role });
      setRoleDraft(null);
      router.refresh();
    });
  }

  function rebuild() {
    const label = TRACK_TEMPLATES[track].label;
    if (!window.confirm(`Deinen ${label}-Lebenslauf mit deinem aktuellen Profil neu erstellen? Ältere Versionen bleiben abrufbar.`)) return;
    requireConsent(
      () =>
        void run("rebuild", async () => {
          await generateResume({ track, targetRole, language });
          router.refresh();
        }),
    );
  }

  function activateSelected() {
    void run("activate", async () => {
      await updateResume(id, { activeVersion: selected });
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm("Diesen Lebenslauf mit allen Versionen löschen?")) return;
    void run("delete", async () => {
      await deleteResume(id);
      router.push("/resume");
      router.refresh();
    });
  }

  // Chat history: oldest first, only versions created by an instruction.
  const history = versions.filter((v) => v.instruction).sort((a, b) => a.version - b.version);
  const busy = pending !== null || draft !== null;

  if (!shown) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Für diesen Lebenslauf gibt es keine gültige Version.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div className="space-y-3 lg:order-1">
        {outdated && selected === activeVersion && pending !== "rebuild" ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
            <p className="min-w-0 flex-1">
              Dein Profil hat sich seit diesem Lebenslauf geändert. Neue Angaben wie Praxiserfahrung oder Projekte erscheinen erst nach
              dem Neu-Erstellen.
            </p>
            <Button size="sm" onClick={rebuild} disabled={busy}>
              <RefreshCwIcon aria-hidden />
              Jetzt neu erstellen
            </Button>
          </div>
        ) : null}
        {roleDraft === null ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Rolle:</span>
            <span className="font-medium break-words">{targetRole}</span>
            <Button size="sm" variant="ghost" onClick={() => setRoleDraft(targetRole)} disabled={busy}>
              <PencilIcon aria-hidden />
              Ändern
            </Button>
          </div>
        ) : (
          <form onSubmit={submitRole} className="flex flex-wrap items-center gap-2">
            <label htmlFor="role-edit" className="sr-only">
              Rolle
            </label>
            <Input
              id="role-edit"
              value={roleDraft}
              onChange={(e) => setRoleDraft(e.target.value)}
              maxLength={120}
              disabled={pending !== null}
              className="min-w-0 flex-1"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={pending !== null || roleDraft.trim().length < 3}>
              {pending === "role" ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              Übernehmen
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRoleDraft(null)} disabled={pending !== null}>
              Abbrechen
            </Button>
          </form>
        )}

        {accepted.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="version-select" className="font-medium">
              Version
            </label>
            <select
              id="version-select"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {accepted.map((v) => (
                <option key={v.version} value={v.version}>
                  {`Version ${v.version}${v.version === activeVersion ? " (aktuell)" : ""} – ${dateFormat.format(new Date(v.createdAt))}`}
                </option>
              ))}
            </select>
            {selected !== activeVersion ? (
              <Button size="sm" variant="outline" onClick={activateSelected} disabled={pending !== null}>
                {pending === "activate" ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
                Diese Version verwenden
              </Button>
            ) : null}
          </div>
        ) : null}

        <ResumePreview resume={shown.content} />

        <div className="flex flex-wrap gap-2">
          <a
            href={exportUrl(id, "pdf", shown.version)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <DownloadIcon className="size-4" aria-hidden />
            PDF herunterladen
          </a>
          <a
            href={exportUrl(id, "docx", shown.version)}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted"
          >
            <DownloadIcon className="size-4" aria-hidden />
            Word (DOCX)
          </a>
          <Button variant="outline" onClick={rebuild} disabled={busy}>
            {pending === "rebuild" ? <Loader2Icon className="animate-spin" aria-hidden /> : <RefreshCwIcon aria-hidden />}
            {pending === "rebuild" ? "Wird neu erstellt …" : "Neu erstellen"}
          </Button>
          <Button variant="ghost" onClick={remove} disabled={pending !== null} className="ml-auto text-destructive">
            {pending === "delete" ? <Loader2Icon className="animate-spin" aria-hidden /> : <Trash2Icon aria-hidden />}
            Löschen
          </Button>
        </div>
        {pending === "rebuild" ? <LlmProgress text="Wir erstellen den Lebenslauf mit deinem aktuellen Profil neu." /> : null}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:order-2">
        {shown.content.gaps.length > 0 ? (
          <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <h2 className="flex items-center gap-2 font-semibold">
              <TriangleAlertIcon className="size-4" aria-hidden />
              Das fehlt deinem Profil für diese Rolle
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {shown.content.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs opacity-80">
              Wir erfinden nichts dazu.{" "}
              <Link href="/onboarding" className="font-medium underline underline-offset-2">
                Ergänze dein Profil
              </Link>
              , wenn du hier Erfahrung hast, und erstelle den Lebenslauf danach neu.
            </p>
          </section>
        ) : null}

        {draft ? <ChangeReview key={draft.version} changes={draft.changes} note={draft.note} onDecide={onDecide} /> : null}

        <section aria-labelledby="chat-title" className="space-y-3 rounded-lg border bg-card p-4">
          <h2 id="chat-title" className="font-semibold">
            Lebenslauf anpassen
          </h2>

          {history.length > 0 ? (
            <ol className="max-h-72 space-y-3 overflow-y-auto text-sm">
              {history.map((v) => (
                <li key={v.version} className="space-y-1">
                  <p className="ml-6 rounded-lg bg-primary px-3 py-2 text-primary-foreground">{v.instruction}</p>
                  {v.notes ? (
                    <p className="mr-6 rounded-lg bg-muted px-3 py-2">
                      {v.notes}
                      {v.status === "rejected" ? <span className="text-muted-foreground"> (verworfen)</span> : null}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sag in eigenen Worten, was anders sein soll. Du siehst jede Änderung, bevor sie übernommen wird.
            </p>
          )}

          {info ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm" aria-live="polite">
              {info}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {draft ? (
            <p className="text-sm text-muted-foreground">Entscheide zuerst über die vorgeschlagenen Änderungen.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInstruction(s)}
                  disabled={busy}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submitInstruction} className="space-y-2">
            <label htmlFor="instruction" className="sr-only">
              Was soll geändert werden?
            </label>
            <Textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="z. B. Betone meine Finance-Erfahrung stärker"
              rows={3}
              maxLength={1000}
              disabled={busy}
            />
            <Button type="submit" disabled={busy || instruction.trim().length < 3} className="w-full">
              {pending === "revise" ? <Loader2Icon className="animate-spin" aria-hidden /> : <SendIcon aria-hidden />}
              {pending === "revise" ? "Wird überarbeitet …" : "Änderung vorschlagen lassen"}
            </Button>
          </form>
          {pending === "revise" ? <LlmProgress text="Wir überarbeiten deinen Lebenslauf nach deiner Anweisung." /> : null}
          {consentDialog}
        </section>
      </aside>
    </div>
  );
}
