import type { Metadata } from "next";
import { FileTextIcon } from "lucide-react";
import { TabPlaceholder } from "@/components/tab-placeholder";

export const metadata: Metadata = { title: "Lebenslauf" };

export default function ResumePage() {
  return (
    <TabPlaceholder
      title="Lebenslauf"
      description="Erstelle einen Lebenslauf, der genau auf die Stelle passt."
      icon={FileTextIcon}
      upcoming={[
        "Lebenslauf hochladen (PDF oder DOCX)",
        "Erfahrungen einsprechen",
        "Auf eine Stellenanzeige zuschneiden und exportieren",
      ]}
    />
  );
}
