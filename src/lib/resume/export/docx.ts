import "server-only";

import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopType, TextRun } from "docx";

import type { Resume } from "@/lib/schemas/resume";

import {
  compactSectionText,
  documentTitle,
  contactLine,
  formatPeriod,
  isCompactSection,
  itemMetaLine,
  resumeLabels,
  visibleSections,
} from "../format";

const FONT = "Calibri";
const ACCENT = "1F3A5F";
const MUTED = "555555";
// A4 width 11906 twips minus 2 × 1134 (2 cm) margins.
const CONTENT_WIDTH = 11906 - 2 * 1134;

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: ACCENT, size: 22 })],
  });
}

export async function renderResumeDocx(resume: Resume): Promise<Buffer> {
  const labels = resumeLabels(resume.language);
  const children: Paragraph[] = [];
  if (resume.header.name) {
    children.push(new Paragraph({ children: [new TextRun({ text: resume.header.name, bold: true, size: 40, color: ACCENT })] }));
  }
  if (resume.header.headline) {
    children.push(new Paragraph({ children: [new TextRun({ text: resume.header.headline, size: 22 })] }));
  }
  children.push(
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: contactLine(resume), size: 18, color: MUTED })] }),
  );

  if (resume.summary) {
    children.push(sectionHeading(labels.summary), new Paragraph({ children: [new TextRun(resume.summary)] }));
  }

  for (const section of visibleSections(resume)) {
    children.push(sectionHeading(section.title));
    if (isCompactSection(section)) {
      children.push(new Paragraph({ children: [new TextRun(compactSectionText(section))] }));
      continue;
    }
    for (const item of section.items) {
      const period = formatPeriod(item.period, resume.language);
      children.push(
        new Paragraph({
          spacing: { before: 120 },
          tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
          keepNext: true,
          children: [
            new TextRun({ text: item.heading, bold: true }),
            ...(period ? [new TextRun({ text: `\t${period}`, color: MUTED })] : []),
          ],
        }),
      );
      const meta = itemMetaLine(item);
      if (meta) {
        children.push(new Paragraph({ keepNext: item.bullets.length > 0, children: [new TextRun({ text: meta, italics: true, color: MUTED })] }));
      }
      for (const bullet of item.bullets) {
        children.push(new Paragraph({ bullet: { level: 0 }, spacing: { before: 20 }, children: [new TextRun(bullet)] }));
      }
    }
  }

  const doc = new Document({
    creator: resume.header.name ?? undefined,
    title: documentTitle(resume),
    styles: { default: { document: { run: { font: FONT, size: 21 }, paragraph: { alignment: AlignmentType.LEFT } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
