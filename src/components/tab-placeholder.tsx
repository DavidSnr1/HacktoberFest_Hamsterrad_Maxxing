import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";

type TabPlaceholderProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  upcoming: string[];
  action?: ReactNode;
};

/** Temporary content for tabs whose features are built in later steps. */
export function TabPlaceholder({ title, description, icon: Icon, upcoming, action }: TabPlaceholderProps) {
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-card px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Icon className="size-6" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg font-semibold">Kommt bald</p>
          <p className="text-sm text-muted-foreground">Hier entsteht:</p>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          {upcoming.map((item) => (
            <li key={item} className="flex items-center justify-center gap-2.5">
              <span className="size-1.5 shrink-0 bg-primary" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        {action}
      </div>
    </section>
  );
}
