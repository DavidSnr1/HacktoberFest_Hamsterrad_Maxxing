import "server-only";

import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

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

const ACCENT = "#1F3A5F";
const MUTED = "#555555";

const styles = StyleSheet.create({
  page: { paddingVertical: 48, paddingHorizontal: 56, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4, color: "#111111" },
  name: { fontFamily: "Helvetica-Bold", fontSize: 20, lineHeight: 1.2, color: ACCENT },
  headline: { fontSize: 11, marginTop: 4 },
  contact: { fontSize: 9, color: MUTED, marginTop: 4 },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: ACCENT,
    marginTop: 14,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: ACCENT,
    textTransform: "uppercase",
  },
  item: { marginTop: 6 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between" },
  itemHeading: { fontFamily: "Helvetica-Bold", flexShrink: 1, paddingRight: 8 },
  period: { color: MUTED },
  meta: { fontFamily: "Helvetica-Oblique", color: MUTED },
  bullet: { flexDirection: "row", marginTop: 1 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
});

function ResumePdf({ resume }: { resume: Resume }) {
  const labels = resumeLabels(resume.language);
  return (
    <Document title={documentTitle(resume)} author={resume.header.name ?? undefined} language={resume.language}>
      <Page size="A4" style={styles.page}>
        {resume.header.name ? <Text style={styles.name}>{resume.header.name}</Text> : null}
        {resume.header.headline ? <Text style={styles.headline}>{resume.header.headline}</Text> : null}
        <Text style={styles.contact}>{contactLine(resume)}</Text>

        {resume.summary ? (
          <View>
            <Text style={styles.sectionTitle}>{labels.summary}</Text>
            <Text>{resume.summary}</Text>
          </View>
        ) : null}

        {visibleSections(resume).map((section) => (
          <View key={section.id}>
            <Text style={styles.sectionTitle} minPresenceAhead={40}>
              {section.title}
            </Text>
            {isCompactSection(section) ? (
              <Text>{compactSectionText(section)}</Text>
            ) : (
              section.items.map((item) => {
                const period = formatPeriod(item.period, resume.language);
                const meta = itemMetaLine(item);
                return (
                  <View key={item.id} style={styles.item} wrap={false}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemHeading}>{item.heading}</Text>
                      {period ? <Text style={styles.period}>{period}</Text> : null}
                    </View>
                    {meta ? <Text style={styles.meta}>{meta}</Text> : null}
                    {item.bullets.map((bullet, i) => (
                      <View key={i} style={styles.bullet}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletText}>{bullet}</Text>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function renderResumePdf(resume: Resume): Promise<Buffer> {
  return renderToBuffer(<ResumePdf resume={resume} />);
}
