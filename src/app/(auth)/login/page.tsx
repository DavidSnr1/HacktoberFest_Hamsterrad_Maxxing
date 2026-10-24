import type { Metadata } from "next";
import { Suspense } from "react";
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

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const isConfigured = getSupabasePublicEnv() !== null;

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Karrierecoach</CardTitle>
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
