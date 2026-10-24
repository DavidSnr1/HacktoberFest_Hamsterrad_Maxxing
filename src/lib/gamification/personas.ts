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
      description: "Schlichter Blazer, frisches Notizbuch und ein Stift, der beim Case hoffentlich nicht leer wird.",
      quote: "Ich strukturiere das kurz.",
    },
    2: {
      title: "Slide-Sprinter",
      description: "Grauer Blazer, Laptop mit Stickern der Uni-Initiative und ein XXL-Becher Matcha neben dem Trackpad.",
      quote: "Folien sind meine Superkraft.",
    },
    3: {
      title: "MECE-Magier",
      description: "Hemdsärmel hoch, Laserpointer in der Tasche und für jedes Lebensproblem eine 2×2-Matrix.",
      quote: "Das ist nicht MECE. Bitte nochmal.",
    },
    4: {
      title: "Pendel-Consultant",
      description: "Blazer mit Vielflieger-Lanyard, Platz im Ruhebereich der 1. Klasse und Hotelstatus-Karte im Portemonnaie.",
      quote: "Der Call dauert nur bis München.",
    },
    5: {
      title: "Video-Call-Profi",
      description: "Perfekt sitzender Anzug, Webcam-Lächeln auf Knopfdruck und ein Deck, das sogar die Kaffeepause quantifiziert.",
      quote: "Lass uns das mal granulieren.",
    },
  },
  finance: {
    1: {
      title: "Formel-Junior",
      description: "Weißes Hemd, schmale Krawatte und ein ordentliches Notizbuch für die ersten Finance Technicals.",
      quote: "Ich prüfe die Formel noch einmal.",
    },
    2: {
      title: "DCF-Denker",
      description: "Dunkelblauer Anzug mit Weste, rote Krawatte und eine Uhr, die bei jeder Zellverknüpfung glänzt.",
      quote: "Enterprise Value, nicht Equity Value.",
    },
    3: {
      title: "Tower-Analyst",
      description: "Maßanzug im 35. Stock, Kaffeebecher in der Hand und das DCF-Modell im Kopf statt im Schlaf.",
      quote: "Gib mir fünf Minuten und ein Terminal.",
    },
    4: {
      title: "Pitchdeck-Globetrotter",
      description: "Luxusuhr am Handgelenk, Business-Class-Kulturbeutel und ein Pitchdeck für drei Tage New York.",
      quote: "Der Case? Schon durchgerechnet.",
    },
    5: {
      title: "3-Uhr-Legende",
      description: "Makelloser Anzug im nächtlichen Tower, drei leere Kaffeebecher und ein Bildschirm voller Modell-Tabs.",
      quote: "90 Stunden sind kein Lifestyle.",
    },
  },
  startup: {
    1: {
      title: "Hoodie-Neuling",
      description: "Lieblingshoodie, saubere Sneaker und ein Laptop, der noch keine Tischtennis-Delle hat.",
      quote: "Wir sind ein kleines Team.",
    },
    2: {
      title: "Agile-Athlet",
      description: "Hoodie mit Firmenlogo, Stehtisch-Setup und Tischtennisschläger für die spontane „Agile Pause“.",
      quote: "Lass uns das nach dem Sprint spielen.",
    },
    3: {
      title: "Deck-Disruptor",
      description: "Overshirt, Laptop voller Prototyp-Sticker und ein Pitchdeck mit mindestens drei Marktgrafiken.",
      quote: "Wir heben disruptive Synergien.",
    },
    4: {
      title: "Loft-Founder",
      description: "Signature-Bomberjacke, Demo-Day-Badge und ein Loft in Berlin oder ein Atelier in München als Kulisse.",
      quote: "Noch schnell das Deck finalisieren, dann ab in den Club.",
    },
    5: {
      title: "Unicorn-Visionär",
      description: "Cleanes Gründer-Outfit, Termsheet unterm Arm und Techno auf den Ohren für nach dem Demo Day.",
      quote: "Das skaliert. Jetzt wirklich.",
    },
  },
};

/** The vibe is the first track in the profile; without one, the default. */
export function vibeFromTracks(tracks: readonly Vibe[] | null | undefined): Vibe {
  return tracks?.[0] ?? DEFAULT_VIBE;
}
