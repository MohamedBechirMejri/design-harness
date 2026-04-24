import { ArrowUpRightIcon, SparklesIcon } from "lucide-react";
import { SidebarInset, SidebarTrigger } from "./ui/sidebar";

const STARTER_PROMPTS = [
  "A bookmark manager, neo-brutalist style",
  "A minimalist habit tracker dashboard",
  "A pricing page for a dev tool startup",
  "A mobile onboarding flow, three screens",
];

export function NoActiveThreadState() {
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <header className="flex items-center gap-3 border-b border-border/60 px-6 py-4">
          <SidebarTrigger className="size-7 shrink-0 md:hidden" />
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-brand/90 text-xs font-semibold text-brand-foreground">
              ◆
            </span>
            <span className="font-display text-[15px] font-medium tracking-tight text-foreground">
              Design Harness
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center px-6">
          <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/[0.06] px-3 py-1 text-xs font-medium text-brand">
              <SparklesIcon className="size-3.5" aria-hidden />
              AI design studio
            </div>
            <div className="flex flex-col gap-3">
              <h1 className="font-display text-balance text-4xl font-medium leading-[1.1] text-foreground sm:text-5xl">
                Describe something you&rsquo;d like to see.
              </h1>
              <p className="text-balance text-base text-muted-foreground sm:text-lg">
                A landing page, a dashboard, a whole product — describe it in plain words, watch it
                render live on the canvas.
              </p>
            </div>
            <div className="w-full rounded-2xl border border-border bg-surface p-6 text-left shadow-soft">
              <div className="mb-3 font-medium text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Try one of these
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {STARTER_PROMPTS.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-transparent bg-background px-3.5 py-2.5 text-left text-sm text-foreground transition-colors hover:border-border-strong hover:bg-accent/60"
                    >
                      <span>{example}</span>
                      <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-5 text-xs text-muted-foreground">
                Start a new design from the sidebar, or press{" "}
                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  ⌘N
                </kbd>
                .
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
