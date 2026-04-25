import { SearchIcon, SettingsIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useCommandPaletteStore } from "../commandPaletteStore";
import { cn } from "~/lib/utils";
import { SidebarTrigger } from "./ui/sidebar";

interface AppTopBarProps {
  /** Optional primary label (e.g. thread title) shown next to the brand mark. */
  title?: string | undefined;
  /** Optional muted secondary label (e.g. project name). */
  subtitle?: string | undefined;
  /** Leading status dot color (e.g. streaming / idle). */
  statusTone?: "brand" | "brand-alt" | "muted" | undefined;
  /** Supplemental controls rendered before the universal action cluster. */
  trailing?: ReactNode | undefined;
  /** Extra className for the outer header. */
  className?: string | undefined;
}

const STATUS_TONE_CLASS: Record<NonNullable<AppTopBarProps["statusTone"]>, string> = {
  brand: "bg-brand",
  "brand-alt": "bg-brand-alt",
  muted: "bg-muted-foreground/60",
};

export function AppTopBar({
  title,
  subtitle,
  statusTone = "brand",
  trailing,
  className,
}: AppTopBarProps) {
  const openCommandPalette = useCommandPaletteStore((state) => state.setOpen);

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/95 pl-3 pr-4 backdrop-blur-md sm:pl-4",
        className,
      )}
    >
      <SidebarTrigger className="size-8 shrink-0" />

      <div className="hidden items-baseline gap-1.5 sm:flex">
        <span aria-hidden className="font-display text-[20px] leading-none text-brand">
          ◆
        </span>
        <span className="font-display text-[20px] leading-none tracking-tight text-foreground">
          Design Harness
        </span>
      </div>

      {title ? (
        <>
          <div aria-hidden className="mx-1 hidden h-5 w-px bg-border-strong/60 sm:block" />
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              aria-hidden
              className={cn("size-1.5 shrink-0 rounded-full", STATUS_TONE_CLASS[statusTone])}
            />
            <h1 className="min-w-0 truncate font-display text-[19px] italic leading-none text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <span className="hidden min-w-0 truncate text-[13px] text-muted-foreground sm:inline">
                · {subtitle}
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        {trailing}
        <button
          type="button"
          onClick={() => openCommandPalette(true)}
          className="group hidden h-8 items-center gap-2 rounded-lg border border-border bg-surface pl-2.5 pr-1.5 text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground sm:inline-flex"
        >
          <SearchIcon className="size-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
          <span>Search</span>
          <kbd className="ml-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => openCommandPalette(true)}
          aria-label="Search"
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden"
        >
          <SearchIcon className="size-4" />
        </button>
        <Link
          to="/settings"
          aria-label="Settings"
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <SettingsIcon className="size-4" />
        </Link>
      </div>
    </header>
  );
}
