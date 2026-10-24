import { Building2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

const LEGAL_FORMS = /\b(gmbh|ag|se|kg|kgaa|ug|mbh|co|inc|ltd|llc|plc|e\.?\s?v)\b\.?/gi;

// "Deutsche Bahn AG" -> "DB", "zeb" -> "Z"
function initials(company: string): string {
  return company
    .replace(LEGAL_FORMS, " ")
    .split(/[\s&+/-]+/)
    .filter((word) => /^[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

// Company placeholder logo: initials on a tinted square (portals don't give us logos).
export function CompanyMark({ company, className }: { company: string | null; className?: string }) {
  const letters = company ? initials(company) : "";
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-sm font-semibold text-primary ring-1 ring-primary/10",
        className,
      )}
    >
      {letters || <Building2Icon className="size-4" />}
    </div>
  );
}
