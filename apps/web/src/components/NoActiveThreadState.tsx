import { ArrowUpRightIcon } from "lucide-react";
import { SidebarInset } from "./ui/sidebar";
import { AppTopBar } from "./AppTopBar";

const STARTER_PROMPTS = [
  "A bookmark manager, neo-brutalist",
  "A minimalist habit-tracker dashboard",
  "A pricing page for a dev-tool startup",
  "A three-screen mobile onboarding flow",
];

export function NoActiveThreadState() {
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <AppTopBar />

        <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-12">
          <div className="flex w-full max-w-3xl flex-col items-center gap-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border-strong/60 bg-surface px-3.5 py-1 text-[13px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              Design studio — research preview
            </div>

            <div className="flex flex-col items-center gap-6">
              <h1 className="font-display text-balance text-[56px] font-normal leading-[1.03] tracking-tight text-foreground sm:text-[72px]">
                Imagine it in words.
                <br />
                <span className="italic text-brand">Watch it render.</span>
              </h1>
              <p className="max-w-xl text-balance text-lg leading-relaxed text-muted-foreground">
                A landing page, a dashboard, a whole product — describe what you&rsquo;re after in
                plain language and it appears on the canvas, ready to shape.
              </p>
            </div>

            <div className="w-full rounded-2xl border border-border bg-surface p-7 text-left shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Start with
                </div>
                <div className="text-[11px] text-muted-foreground/70">Or describe your own</div>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {STARTER_PROMPTS.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between gap-3 rounded-xl border border-transparent bg-background px-4 py-3 text-left text-[15px] text-foreground transition-colors hover:border-border-strong hover:bg-accent/70"
                    >
                      <span className="font-display italic text-[17px] leading-tight">
                        {example}
                      </span>
                      <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
                <span>Start a new design from the sidebar, or press</span>
                <kbd className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
                  ⌘N
                </kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
