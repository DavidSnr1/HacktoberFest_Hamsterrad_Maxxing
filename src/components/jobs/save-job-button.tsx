"use client";

import { BookmarkCheckIcon, BookmarkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  saved: boolean;
  pending: boolean;
  onToggle: () => void;
  withLabel?: boolean;
};

export function SaveJobButton({ saved, pending, onToggle, withLabel = false }: Props) {
  const label = saved ? "Gemerkt" : "Merken";
  return (
    <Button
      type="button"
      variant={saved ? "secondary" : "outline"}
      size={withLabel ? "default" : "icon"}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Nicht mehr merken" : "Stelle merken"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {saved ? <BookmarkCheckIcon aria-hidden /> : <BookmarkIcon aria-hidden />}
      {withLabel && label}
    </Button>
  );
}
