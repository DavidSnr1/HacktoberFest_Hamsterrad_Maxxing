import type { Metadata } from "next";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { devLoginEmails } from "@/lib/dev-login";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { DevLoginForm } from "./dev-login-form";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

const ERROR_MESSAGES: Record<string, string> = {
  link: "Der Anmelde-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
  config: "Supabase ist noch nicht konfiguriert.",
  dev: "Diese Adresse ist für die Direktanmeldung nicht freigegeben (DEV_LOGIN_EMAILS in .env.local).",
};

const HIGHLIGHTS = [
  { term: "Interviews", detail: "Mock Interviews für Consulting, Finance und Startup" },
  { term: "Lebenslauf", detail: "Auf die Stelle zugeschnitten, als PDF und DOCX" },
  { term: "Stellen", detail: "Praktika und Einstiegsjobs aus mehreren Portalen" },
];

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const isConfigured = getSupabasePublicEnv() !== null;

  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between gap-12 border-r bg-card p-10 lg:flex xl:p-14">
        <Brand />
        <div className="flex max-w-lg flex-col gap-8">
          <h1 className="text-5xl leading-[1.02] font-extrabold tracking-[-0.04em]">
            Gut vorbereitet ins Interview bei Beratung, Bank oder Startup.
          </h1>
          <JobAdExcerpt />
          <dl className="grid grid-cols-3 gap-6 border-t pt-6">
            {HIGHLIGHTS.map((item) => (
              <div key={item.term} className="flex flex-col gap-1">
                <dt className="text-sm font-semibold">{item.term}</dt>
                <dd className="text-sm leading-snug text-muted-foreground">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center gap-8 px-4 py-10">
        <Brand className="lg:hidden" />
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">Anmelden</CardTitle>
            <CardDescription>
              Melde dich mit deiner E-Mail-Adresse an. Du bekommst einen Link, ein
              Passwort brauchst du nicht.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Suspense>
              <ErrorNotice searchParams={searchParams} />
            </Suspense>
            {isConfigured ? (
              <>
                <LoginForm />
                {devLoginEmails().length > 0 && <DevLoginForm />}
              </>
            ) : (
              <div
                className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground"
                role="status"
              >
                <p className="font-medium text-foreground">Einrichtung fehlt</p>
                <p className="mt-1">
                  Trage <code>NEXT_PUBLIC_SUPABASE_URL</code> und{" "}
                  <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>{" "}
                  ein und starte den Dev-Server neu. Details stehen in der README.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

/**
 * A fragment of a real-looking job ad with its requirements marked, which is
 * what the app does with the user's resume. The strokes draw in once on load.
 */
function JobAdExcerpt() {
  return (
    <figure className="flex flex-col gap-3 rounded-lg border bg-background p-5 text-[0.95rem] leading-relaxed" aria-hidden>
      <p className="font-semibold">Praktikum Strategy Consulting (m/w/d)</p>
      <ul className="flex flex-col gap-1.5 text-muted-foreground">
        <li>
          Du bringst <mark className="highlight draw-in bg-transparent text-foreground">analytisches Denkvermögen</mark> und
          Freude an Zahlen mit.
        </li>
        <li>
          Erste Praxiserfahrung, idealerweise in der{" "}
          <mark className="highlight draw-in bg-transparent text-foreground [animation-delay:350ms]">Beratung</mark>.
        </li>
        <li>
          <mark className="highlight draw-in bg-transparent text-foreground [animation-delay:700ms]">Sichere Kommunikation</mark>{" "}
          auf Deutsch und Englisch.
        </li>
      </ul>
    </figure>
  );
}

/** Shows an error passed back from the auth callback (?error=...). */
async function ErrorNotice({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERROR_MESSAGES[error] : undefined;
  if (!message) return null;

  return (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
