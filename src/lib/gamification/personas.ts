import type { InterviewTrack } from "@/lib/interview/tracks";
import type { Level } from "./levels";

/**
 * The avatar's look follows the first track in the candidate profile (the
 * "vibe"). Each vibe has one persona per level; its name is the level title.
 */
export type Vibe = InterviewTrack;

export const DEFAULT_VIBE: Vibe = "consulting";
export const VIBE_ORDER: Vibe[] = ["consulting", "finance", "startup"];

export const VIBE_LABELS: Record<Vibe, string> = {
  consulting: "Management Consulting",
  finance: "Investment Banking & Private Equity",
  startup: "Tech-Startup & VC",
};

export type Persona = { title: string; description: string; quote: string };

export const PERSONAS: Record<Vibe, Record<Level, Persona>> = {
  consulting: {
    1: {
      title: "Case-Neuling",
      description: "Erster Anzug, Rollkoffer im Großraumbüro und ein Laptop voller Charts, die noch niemand gesehen hat.",
      quote: "Ich strukturiere das kurz.",
    },
    2: {
      title: "Pendel-Consultant",
      description: "Ledertasche über der Schulter, Telefon am Ohr und der Klient im ICE-Großraumwagen immer dabei.",
      quote: "Der Call dauert nur bis München.",
    },
    3: {
      title: "Partner-Kandidat",
      description: "Nadelstreifen, Lesebrille und die Visitenkarte griffbereit in der Lobby des Fünf-Sterne-Hotels.",
      quote: "Lass uns das mal granulieren.",
    },
  },
  finance: {
    1: {
      title: "Formel-Junior",
      description: "Fleece-Weste, Kaffee to go und das erste Modell auf zwei Bildschirmen im Trading-Floor-Ambiente.",
      quote: "Ich prüfe die Formel noch einmal.",
    },
    2: {
      title: "Tower-Analyst",
      description: "Krawatte unter der Weste, Brille auf der Nase und die Skyline als Hintergrund für jeden Deal-Call.",
      quote: "Enterprise Value, nicht Equity Value.",
    },
    3: {
      title: "Eckbüro-Legende",
      description: "Nadelstreifenanzug, Whisky im Kristallglas und die nächtliche Skyline vor dem eigenen Eckbüro.",
      quote: "Der Case? Schon durchgerechnet.",
    },
  },
  startup: {
    1: {
      title: "Garagen-Gründer",
      description: "Hoodie, Sticker-Laptop und Kaffeebecher zwischen Umzugskartons in der ersten Garage.",
      quote: "Wir sind ein kleines Team.",
    },
    2: {
      title: "Scale-up-Builder",
      description: "Pullover statt Hoodie, Thermobecher in der Hand und ein Großraumbüro voller neuer Teammitglieder.",
      quote: "Wir heben disruptive Synergien.",
    },
    3: {
      title: "Exit-Visionär",
      description: "Leinenhemd, Sonnenbrille und der Laptop auf der Strandliege – die Firma läuft inzwischen ohne ihn.",
      quote: "Das skaliert. Jetzt wirklich.",
    },
  },
};

/** The vibe is the first track in the profile; without one, the default. */
export function vibeFromTracks(tracks: readonly Vibe[] | null | undefined): Vibe {
  return tracks?.[0] ?? DEFAULT_VIBE;
}
