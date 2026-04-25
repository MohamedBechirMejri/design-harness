import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRightIcon,
  CodeIcon,
  EyeIcon,
  FileIcon,
  MonitorIcon,
  RefreshCwIcon,
  SmartphoneIcon,
  TabletIcon,
} from "lucide-react";
import type { DesignPreviewEntry, EnvironmentId, ThreadId } from "@dh/contracts";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "~/lib/utils";
import { readEnvironmentApi } from "~/environmentApi";

const POLL_INTERVAL_MS = 2000;
const EMPTY_ENTRIES: ReadonlyArray<DesignPreviewEntry> = [];

interface DesignPreviewSidebarProps {
  environmentId: EnvironmentId;
  threadId: ThreadId;
  workspaceRoot: string | undefined;
  mode?: "sheet" | "sidebar" | "pane";
}

type ViewportPreset = "auto" | "mobile" | "tablet" | "desktop";

const VIEWPORT_WIDTHS: Record<Exclude<ViewportPreset, "auto">, number> = {
  mobile: 390,
  tablet: 820,
  desktop: 1280,
};

const VIEWPORT_LABELS: Record<ViewportPreset, string> = {
  auto: "Fit",
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

const VIEWPORT_ICON: Record<Exclude<ViewportPreset, "auto">, typeof SmartphoneIcon> = {
  mobile: SmartphoneIcon,
  tablet: TabletIcon,
  desktop: MonitorIcon,
};

function isHtmlFile(path: string): boolean {
  return /\.(html?|htm)$/i.test(path);
}

const DesignPreviewSidebar = memo(function DesignPreviewSidebar({
  environmentId,
  threadId,
  workspaceRoot,
  mode = "sidebar",
}: DesignPreviewSidebarProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportPreset>("auto");
  const [view, setView] = useState<"preview" | "source">("preview");

  const listQuery = useQuery({
    queryKey: ["designPreviewList", environmentId, workspaceRoot, threadId],
    enabled: Boolean(workspaceRoot),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      if (!workspaceRoot) return { entries: EMPTY_ENTRIES };
      const api = readEnvironmentApi(environmentId);
      if (!api) return { entries: EMPTY_ENTRIES };
      try {
        return await api.designPreview.list({ cwd: workspaceRoot, threadId });
      } catch (error) {
        console.warn("[designPreview.list] failed", {
          cwd: workspaceRoot,
          threadId,
          error,
        });
        throw error;
      }
    },
  });

  const entries = listQuery.data?.entries ?? EMPTY_ENTRIES;
  const resolvedAbsolutePath = listQuery.data?.resolvedAbsolutePath;
  const htmlEntries = useMemo(
    () => entries.filter((entry) => isHtmlFile(entry.relativePath)),
    [entries],
  );
  useEffect(() => {
    if (selectedPath && entries.some((entry) => entry.relativePath === selectedPath)) {
      return;
    }
    if (htmlEntries.length > 0) {
      setSelectedPath(htmlEntries[0]!.relativePath);
      return;
    }
    if (entries.length > 0) {
      setSelectedPath(entries[0]!.relativePath);
      return;
    }
    setSelectedPath(null);
  }, [entries, htmlEntries, selectedPath]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.relativePath === selectedPath) ?? null,
    [entries, selectedPath],
  );

  const readQuery = useQuery({
    queryKey: [
      "designPreviewRead",
      environmentId,
      workspaceRoot,
      threadId,
      selectedPath,
      selectedEntry?.modifiedAtMs ?? 0,
    ],
    enabled: Boolean(workspaceRoot && selectedPath),
    queryFn: async () => {
      if (!workspaceRoot || !selectedPath) return null;
      const api = readEnvironmentApi(environmentId);
      if (!api) return null;
      return api.designPreview.read({
        cwd: workspaceRoot,
        threadId,
        relativePath: selectedPath,
      });
    },
  });

  const contents = readQuery.data?.contents ?? "";
  const selectedIsHtml = selectedPath ? isHtmlFile(selectedPath) : false;
  const hasEntries = entries.length > 0;

  const openInNewTab =
    selectedIsHtml && contents
      ? () => {
          const blob = new Blob([contents], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank", "noopener,noreferrer");
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
      : null;

  const showViewportControls = selectedIsHtml && view === "preview" && hasEntries;
  const viewportWidth = viewport === "auto" ? null : VIEWPORT_WIDTHS[viewport];

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-background",
        mode === "sidebar" ? "h-full w-[560px] shrink-0 border-l border-border" : "h-full w-full",
      )}
    >
      {/* Canvas header — file tabs as the primary nav, compact actions on the right */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface/60 pl-2 pr-3">
        {hasEntries ? (
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {entries.map((entry) => {
              const isActive = selectedPath === entry.relativePath;
              const isHtml = isHtmlFile(entry.relativePath);
              return (
                <button
                  key={entry.relativePath}
                  type="button"
                  onClick={() => setSelectedPath(entry.relativePath)}
                  title={entry.relativePath}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors",
                    isActive
                      ? "border-border-strong bg-background text-foreground shadow-soft"
                      : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <FileIcon
                    className={cn(
                      "size-3.5 shrink-0",
                      isActive ? "text-brand" : "text-muted-foreground/70",
                    )}
                  />
                  <span className="max-w-[180px] truncate font-mono text-[12px]">{entry.name}</span>
                  {!isHtml ? (
                    <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/60">
                      txt
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 pl-1 text-[13px]">
            <span className="font-display text-[17px] italic text-foreground">Canvas</span>
            <span className="text-muted-foreground/70">— waiting for a design</span>
          </div>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {selectedIsHtml ? <ViewToggle view={view} onChange={setView} /> : null}
          {showViewportControls ? (
            <ViewportPicker viewport={viewport} onChange={setViewport} />
          ) : null}
          {openInNewTab ? (
            <button
              type="button"
              onClick={openInNewTab}
              aria-label="Open in new tab"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
            >
              <ArrowUpRightIcon className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => listQuery.refetch()}
            aria-label="Refresh"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
          >
            <RefreshCwIcon className={cn("size-4", listQuery.isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Canvas body */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        {!hasEntries ? (
          <CanvasEmptyState
            isError={listQuery.isError}
            isPending={listQuery.isPending}
            error={listQuery.error}
            absolutePath={resolvedAbsolutePath}
          />
        ) : !selectedPath ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-surface text-[13px] text-muted-foreground">
            Select a file to preview.
          </div>
        ) : readQuery.isPending ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-surface text-[13px] text-muted-foreground">
            Loading…
          </div>
        ) : readQuery.isError ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-destructive/40 bg-destructive/5 px-6 text-center text-[13px] text-destructive">
            Failed to load file.
          </div>
        ) : selectedIsHtml && view === "preview" ? (
          <div
            className={cn(
              "flex min-h-0 flex-1 overflow-auto rounded-2xl",
              viewportWidth === null
                ? "border border-border-strong/60 bg-white shadow-soft"
                : "items-start justify-center bg-surface/40 p-4",
            )}
          >
            <div
              className={cn(
                "flex min-h-0 overflow-hidden bg-white",
                viewportWidth === null
                  ? "h-full w-full"
                  : "rounded-xl border border-border-strong/60 shadow-soft",
              )}
              style={
                viewportWidth === null
                  ? undefined
                  : {
                      width: `${viewportWidth}px`,
                      maxWidth: "100%",
                      minHeight: "100%",
                    }
              }
            >
              <iframe
                key={`${selectedPath}:${selectedEntry?.modifiedAtMs ?? 0}`}
                title={`Preview of ${selectedPath}`}
                sandbox="allow-scripts allow-forms allow-popups"
                srcDoc={contents}
                className="h-full w-full border-0 bg-white"
                style={
                  viewportWidth === null
                    ? undefined
                    : {
                        width: `${viewportWidth}px`,
                        minHeight: "100%",
                      }
                }
              />
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full rounded-2xl border border-border bg-surface">
            <pre className="whitespace-pre-wrap break-words p-5 font-mono text-[13px] leading-relaxed text-foreground/90">
              {contents}
            </pre>
          </ScrollArea>
        )}
      </div>
    </div>
  );
});

interface ViewportPickerProps {
  viewport: ViewportPreset;
  onChange: (next: ViewportPreset) => void;
}

function ViewportPicker({ viewport, onChange }: ViewportPickerProps) {
  const presets: ReadonlyArray<{
    value: ViewportPreset;
    label: string;
    icon: typeof SmartphoneIcon | null;
  }> = [
    { value: "auto", label: VIEWPORT_LABELS.auto, icon: null },
    { value: "mobile", label: VIEWPORT_LABELS.mobile, icon: VIEWPORT_ICON.mobile },
    { value: "tablet", label: VIEWPORT_LABELS.tablet, icon: VIEWPORT_ICON.tablet },
    { value: "desktop", label: VIEWPORT_LABELS.desktop, icon: VIEWPORT_ICON.desktop },
  ];

  return (
    <div
      role="group"
      aria-label="Preview viewport"
      className="ml-1 inline-flex items-center gap-0.5 rounded-md bg-accent/40 p-0.5"
    >
      {presets.map(({ value, label, icon: Icon }) => {
        const isActive = viewport === value;
        const titleSuffix =
          value === "auto"
            ? ""
            : ` (${VIEWPORT_WIDTHS[value as Exclude<ViewportPreset, "auto">]}px)`;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-label={`${label}${titleSuffix}`}
            title={`${label}${titleSuffix}`}
            aria-pressed={isActive}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="size-3" aria-hidden /> : null}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface ViewToggleProps {
  view: "preview" | "source";
  onChange: (next: "preview" | "source") => void;
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Preview / source"
      className="inline-flex items-center gap-0.5 rounded-md bg-accent/40 p-0.5"
    >
      <button
        type="button"
        onClick={() => onChange("preview")}
        aria-label="Preview"
        title="Preview"
        aria-pressed={view === "preview"}
        className={cn(
          "inline-flex size-6 items-center justify-center rounded text-[11px] transition-colors",
          view === "preview"
            ? "bg-background text-foreground shadow-soft"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <EyeIcon className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onChange("source")}
        aria-label="Source"
        title="Source"
        aria-pressed={view === "source"}
        className={cn(
          "inline-flex size-6 items-center justify-center rounded text-[11px] transition-colors",
          view === "source"
            ? "bg-background text-foreground shadow-soft"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <CodeIcon className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

interface CanvasEmptyStateProps {
  isError: boolean;
  isPending: boolean;
  error: unknown;
  absolutePath: string | undefined;
}

function CanvasEmptyState({ isError, isPending, error, absolutePath }: CanvasEmptyStateProps) {
  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-8 text-center">
        <div className="font-display text-[22px] italic leading-tight text-destructive">
          Failed to load design files.
        </div>
        <div className="max-w-md text-[13px] text-destructive/80">
          {error instanceof Error ? error.message : String(error ?? "Unknown error.")}
        </div>
        {absolutePath ? (
          <div className="mt-2 max-w-md break-all font-mono text-[11px] text-muted-foreground">
            {absolutePath}
          </div>
        ) : null}
      </div>
    );
  }
  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-surface text-[13px] text-muted-foreground">
        Loading…
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border-strong/60 bg-surface/60 px-8 text-center">
      <div
        aria-hidden
        className="flex size-16 items-center justify-center rounded-2xl border border-border-strong/60 bg-background"
      >
        <span className="font-display text-[28px] italic text-brand/80">◆</span>
      </div>
      <div className="flex max-w-md flex-col gap-1.5">
        <div className="font-display text-[26px] italic leading-tight text-foreground">
          Your design will appear here.
        </div>
        <div className="text-[14px] leading-relaxed text-muted-foreground">
          Describe what you want in the chat. The canvas refreshes as the model writes HTML.
        </div>
      </div>
      {absolutePath ? (
        <div className="mt-1 max-w-md break-all font-mono text-[11px] text-muted-foreground/70">
          {absolutePath}
        </div>
      ) : null}
    </div>
  );
}

export default DesignPreviewSidebar;
