import {
  compactSectionText,
  contactLine,
  formatPeriod,
  isCompactSection,
  itemMetaLine,
  resumeLabels,
  visibleSections,
} from "@/lib/resume/format";
import type { Resume } from "@/lib/schemas/resume";

/** On-screen rendering of a resume; mirrors the DOCX/PDF template. */
export function ResumePreview({ resume }: { resume: Resume }) {
  const labels = resumeLabels(resume.language);
  return (
    <article lang={resume.language} className="rounded-lg border bg-white p-5 text-sm leading-relaxed text-neutral-900 shadow-sm sm:p-8">
      <header>
        {resume.header.name ? (
          <h2 className="text-2xl font-bold text-[#1F3A5F]">{resume.header.name}</h2>
        ) : (
          <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
            Dein Name fehlt – er wird aus deinem Konto übernommen. Trag ihn dort ein, dann erscheint er hier und im Export.
          </p>
        )}
        {resume.header.headline ? <p className="mt-1">{resume.header.headline}</p> : null}
        <p className="mt-1 text-xs break-words text-neutral-600">{contactLine(resume)}</p>
      </header>

      {resume.summary ? (
        <PreviewSection title={labels.summary}>
          <p>{resume.summary}</p>
        </PreviewSection>
      ) : null}

      {visibleSections(resume).map((section) => (
        <PreviewSection key={section.id} title={section.title}>
          {isCompactSection(section) ? (
            <p>{compactSectionText(section)}</p>
          ) : (
            <div className="space-y-3">
              {section.items.map((item) => {
                const period = formatPeriod(item.period, resume.language);
                const meta = itemMetaLine(item);
                return (
                  <div key={item.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="font-semibold">{item.heading}</p>
                      {period ? <p className="text-xs text-neutral-600 tabular-nums">{period}</p> : null}
                    </div>
                    {meta ? <p className="text-neutral-600 italic">{meta}</p> : null}
                    {item.bullets.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {item.bullets.map((bullet, i) => (
                          <li key={i}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </PreviewSection>
      ))}
    </article>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 border-b border-[#1F3A5F] pb-0.5 text-xs font-bold tracking-wide text-[#1F3A5F] uppercase">{title}</h3>
      {children}
    </section>
  );
}
