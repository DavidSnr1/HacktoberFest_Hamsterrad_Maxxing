import type { Metadata } from "next";
import { UserRoundIcon } from "lucide-react";
import { TabPlaceholder } from "@/components/tab-placeholder";

export const metadata: Metadata = { title: "Charakter" };

export default function CharacterPage() {
  return (
    <TabPlaceholder
      title="Charakter"
      description="Dein Avatar wächst mit jedem Interview und jedem Lebenslauf."
      icon={UserRoundIcon}
      upcoming={["Level und XP", "Badges und Streaks", "Avatar, der sich mit dem Level verändert"]}
    />
  );
}
