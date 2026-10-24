import { resumeProfileSchema, type ResumeProfile, type ResumeDraft } from "@/lib/schemas/resume";

import { resolveResume } from "../resolve";
import lenaProfile from "./fixtures/lena-profile.json";

/** Internal-format profile with experience, used for the generic resume logic. */
export function lena(): ResumeProfile {
  return resumeProfileSchema.parse(lenaProfile);
}

export function lenaDraft(): ResumeDraft {
  return {
    summary: "Masterstudentin mit Praxis in Strategieberatung und Corporate Finance.",
    sections: [
      {
        id: "s-exp",
        kind: "experience",
        title: "Praxiserfahrung",
        items: [
          {
            id: "i-strategy",
            sourceRefs: ["exp-strategy"],
            bullets: ["40 Experteninterviews für eine Marktanalyse ausgewertet", "Kostenmodell für 3 Standortoptionen in Excel gebaut"],
          },
          { id: "i-bank", sourceRefs: ["exp-bank", "skill-powerbi"], bullets: ["Reporting in Power BI automatisiert (ca. 4 Stunden pro Woche gespart)"] },
        ],
      },
      {
        id: "s-edu",
        kind: "education",
        title: "Ausbildung",
        items: [
          { id: "i-tum", sourceRefs: ["edu-tum"], bullets: [] },
          { id: "i-mannheim", sourceRefs: ["edu-mannheim"], bullets: [] },
        ],
      },
      {
        id: "s-skills",
        kind: "skills",
        title: "Kenntnisse",
        items: [
          { id: "i-excel", sourceRefs: ["skill-excel"], bullets: [] },
          { id: "i-ppt", sourceRefs: ["skill-ppt"], bullets: [] },
        ],
      },
    ],
  };
}

export function lenaResume() {
  return resolveResume(lenaDraft(), lena(), { language: "de", targetRole: "Werkstudent Strategy Consulting", gaps: [] });
}
