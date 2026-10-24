import type { Metadata } from "next";
import { BadgeList } from "@/components/character/badge-list";
import { CharacterHero } from "@/components/character/character-hero";
import { PersonaGallery } from "@/components/character/persona-gallery";
import { Quests } from "@/components/character/quests";
import { XpHistory } from "@/components/character/xp-history";
import { PageHeader } from "@/components/page-header";
import { getCharacterState } from "@/lib/gamification/server";

export const metadata: Metadata = { title: "Charakter" };

export default async function CharacterPage() {
  const result = await getCharacterState();

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Charakter"
          description="Jedes Interview, jeder Lebenslauf und jede Station im Profil bringt dir XP. Dein Avatar wächst mit."
        />
        {result.kind === "ok" ? (
          <CharacterHero
            progress={result.state.progress}
            vibe={result.state.vibe}
            vibeFromProfile={result.state.vibeFromProfile}
            streak={result.state.streak}
            lastSeenLevel={result.state.lastSeenLevel}
          />
        ) : (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive" role="alert">
            {result.kind === "signed_out"
              ? "Bitte melde dich erneut an."
              : "Dein Fortschritt konnte gerade nicht geladen werden. Bitte lade die Seite neu."}
          </p>
        )}
      </div>

      {result.kind === "ok" && (
        <>
          <Quests state={result.state} />
          <BadgeList badges={result.state.badges} />
          <XpHistory events={result.state.recentEvents} />
          <PersonaGallery vibe={result.state.vibe} level={result.state.progress.level} />
        </>
      )}
    </div>
  );
}
