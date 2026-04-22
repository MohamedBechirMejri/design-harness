import { PaletteIcon, SparklesIcon } from "lucide-react";
import { SidebarInset, SidebarTrigger } from "./ui/sidebar";
import { isElectron } from "../env";
import { cn } from "~/lib/utils";

export function NoActiveThreadState() {
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <header
          className={cn(
            "border-b border-border/60 px-3 sm:px-5",
            isElectron
              ? "drag-region flex h-[52px] items-center wco:h-[env(titlebar-area-height)]"
              : "py-2 sm:py-3",
          )}
        >
          {isElectron ? (
            <span className="text-xs text-muted-foreground/50 wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]">
              t3design
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <PaletteIcon className="size-4 text-pink-400" aria-hidden />
              <span className="text-sm font-medium text-foreground md:text-muted-foreground/70">
                t3design
              </span>
            </div>
          )}
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-400/20 bg-pink-400/5 px-3 py-1 text-xs text-pink-300">
              <SparklesIcon className="size-3.5" aria-hidden />
              AI design studio
            </div>
            <div className="flex flex-col gap-3">
              <h1 className="text-balance text-3xl font-semibold text-foreground sm:text-4xl">
                Describe a design.
              </h1>
              <p className="text-balance text-sm text-muted-foreground/80 sm:text-base">
                Ask for a UI, a landing page, a component, or a whole screen. Watch it come to life
                live in the preview pane on the right.
              </p>
            </div>
            <div className="w-full rounded-2xl border border-border/60 bg-card/40 p-5 text-left text-sm text-muted-foreground/70 shadow-sm/5">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground/50">
                Try one of these
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {[
                  "A bookmark manager, neo-brutalist style",
                  "A minimalist habit tracker dashboard",
                  "A pricing page for a dev tool startup",
                  "A mobile onboarding flow, 3 screens",
                ].map((example) => (
                  <li
                    key={example}
                    className="rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-foreground/80"
                  >
                    {example}
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-xs text-muted-foreground/50">
                Start a new design from the left sidebar to begin.
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
