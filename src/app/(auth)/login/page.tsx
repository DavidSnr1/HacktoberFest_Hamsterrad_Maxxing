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
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

const ERROR_MESSAGES: Record<string, string> = {
  link: "Der Anmelde-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
  config: "Supabase ist noch nicht konfiguriert.",
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
      <section className="hidden flex-col justify-between gap-12 bg-primary p-10 text-primary-foreground lg:flex xl:p-14">
        <Brand />
        <div className="flex max-w-lg flex-col gap-5">
          <p className="flex items-center gap-2 text-[0.7rem] font-semibold tracking-[0.14em] text-gold uppercase">
            <span className="h-px w-6 bg-gold" aria-hidden />
            Bewerbungstraining
          </p>
          <p className="font-heading text-4xl leading-tight font-semibold text-balance">
            Gut vorbereitet ins Interview bei Beratung, Bank oder Startup.
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-6 border-t border-white/15 pt-6">
            {HIGHLIGHTS.map((item) => (
              <div key={item.term} className="flex flex-col gap-1">
                <dt className="text-[0.7rem] font-semibold tracking-[0.12em] text-primary-foreground/60 uppercase">
                  {item.term}
                </dt>
                <dd className="text-sm leading-snug">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center gap-8 px-4 py-10">
        <div className="rounded-md bg-primary px-4 py-3 text-primary-foreground lg:hidden">
          <Brand />
        </div>
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
              <LoginForm />
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
