import type { LucideIcon } from "lucide-react";

type TabPlaceholderProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  upcoming: string[];
};

/** Temporary content for tabs whose features are built in later steps. */
export function TabPlaceholder({ title, description, icon: Icon, upcoming }: TabPlaceholderProps) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </header>
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-medium">Kommt bald</p>
          <p className="text-sm text-muted-foreground">Hier entsteht:</p>
        </div>
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {upcoming.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
