import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ClipboardIcon,
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
const EMPTY_ASSET_MAP: ReadonlyMap<string, string> = new Map();

// CSS/JS need inlining because the iframe renders via `srcDoc` at
// `about:srcdoc`, which has no usable base URL for sibling fetches.
// JSX/TSX are added so React-mode designs (Babel Standalone + CDN React)
// can split components across files and still render in the iframe — we
// rewrite their `<script type="text/babel" src="components/Foo.jsx">` tags
// to inline scripts, preserving `type` and `data-presets` attributes.
const INLINABLE_ASSET_RE = /\.(css|jsx|tsx|js|mjs|cjs)$/i;

function isInlinableAssetPath(path: string): boolean {
  return INLINABLE_ASSET_RE.test(path);
}

function normalizeRelativeAssetPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // External or absolute references — leave them alone.
  if (
    /^[a-z][a-z0-9+\-.]*:/i.test(trimmed) ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return null;
  }
  // Strip query/hash so we can match against the asset map keys.
  const withoutQuery = trimmed.replace(/[?#].*$/, "");
  if (withoutQuery.startsWith("./")) return withoutQuery.slice(2);
  return withoutQuery;
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function escapeStyleContents(input: string): string {
  // Avoid breaking out of the <style> tag inside the iframe's srcdoc.
  return input.replace(/<\/style/gi, "<\\/style");
}

function escapeScriptContents(input: string): string {
  return input.replace(/<\/script/gi, "<\\/script");
}

/**
 * Rewrite local `<link rel="stylesheet">` and `<script src="…">` references
 * in an HTML document so the iframe (rendered via `srcDoc`, which has no
 * usable base URL) can still load the design's sibling assets.
 *
 * - CSS: replaced with `<style>…</style>` containing the file contents.
 * - JS:  replaced with `<script>…</script>` (preserving `type` and `defer`).
 * - Anything we can't resolve (external URLs, missing files, images we
 *   don't have bytes for) is left untouched.
 */
function inlineLocalAssets(input: {
  html: string;
  htmlPath: string;
  assets: ReadonlyMap<string, string>;
}): string {
  if (input.assets.size === 0) return input.html;

  const linkPattern = /<link\b([^>]*)>/gi;
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

  const lookup = (rawPath: string): string | null => {
    const normalized = normalizeRelativeAssetPath(rawPath);
    if (!normalized) return null;
    return input.assets.get(normalized) ?? null;
  };

  let html = input.html.replace(linkPattern, (match, attrs: string) => {
    const isStylesheet = /\brel\s*=\s*["']?stylesheet["']?/i.test(attrs);
    if (!isStylesheet) return match;
    const hrefMatch = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const href = hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4];
    if (!href) return match;
    const contents = lookup(href);
    if (contents === null) return match;
    return `<style data-design-source="${escapeHtml(href)}">${escapeStyleContents(contents)}</style>`;
  });

  html = html.replace(scriptPattern, (match, attrs: string, body: string) => {
    const srcMatch = /\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (!srcMatch) return match;
    const src = srcMatch[2] ?? srcMatch[3] ?? srcMatch[4];
    if (!src) return match;
    const contents = lookup(src);
    if (contents === null) return match;
    // Preserve type and defer/async/module attributes by reusing the original
    // attrs but stripping the `src=` clause. Inlined module scripts still need
    // `type="module"` to evaluate as ESM.
    const cleaned = attrs
      .replace(/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const attrPrefix = cleaned.length > 0 ? ` ${cleaned}` : "";
    return `<script${attrPrefix} data-design-source="${escapeHtml(src)}">${escapeScriptContents(contents)}${body ?? ""}</script>`;
  });

  return html;
}
const VIEWPORT_STORAGE_KEY = "dh:design-preview:viewport";

function readPersistedViewport(): ViewportPreset {
  if (typeof window === "undefined") return "auto";
  try {
    const stored = window.localStorage.getItem(VIEWPORT_STORAGE_KEY);
    if (stored === "auto" || stored === "mobile" || stored === "tablet" || stored === "desktop") {
      return stored;
    }
  } catch {
    // ignore
  }
  return "auto";
}

function persistViewport(viewport: ViewportPreset): void {
  try {
    window.localStorage.setItem(VIEWPORT_STORAGE_KEY, viewport);
  } catch {
    // ignore
  }
}

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
  const [viewport, setViewportState] = useState<ViewportPreset>(() => readPersistedViewport());
  const [view, setView] = useState<"preview" | "source">("preview");
  const setViewport = useCallback((next: ViewportPreset) => {
    setViewportState(next);
    persistViewport(next);
  }, []);

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

  // When an HTML file is selected, fetch its sibling CSS/JS assets so we can
  // inline them. Iframe `srcDoc` lives at `about:srcdoc` which has no useful
  // base URL, so `<link href="styles.css">` and `<script src="app.js">` 404
  // unless we either inline the bytes or rewrite them to blob: URLs.
  const inlinableAssetEntries = useMemo(
    () =>
      selectedIsHtml
        ? entries.filter((entry) => isInlinableAssetPath(entry.relativePath))
        : EMPTY_ENTRIES,
    [entries, selectedIsHtml],
  );
  const inlinableAssetSignature = useMemo(
    () =>
      inlinableAssetEntries
        .map((entry) => `${entry.relativePath}:${entry.modifiedAtMs ?? 0}`)
        .join("|"),
    [inlinableAssetEntries],
  );
  const assetsQuery = useQuery({
    queryKey: [
      "designPreviewAssets",
      environmentId,
      workspaceRoot,
      threadId,
      inlinableAssetSignature,
    ],
    enabled: Boolean(workspaceRoot && selectedIsHtml && inlinableAssetEntries.length > 0),
    queryFn: async (): Promise<ReadonlyMap<string, string>> => {
      if (!workspaceRoot) return EMPTY_ASSET_MAP;
      const api = readEnvironmentApi(environmentId);
      if (!api) return EMPTY_ASSET_MAP;
      const settled = await Promise.all(
        inlinableAssetEntries.map(async (entry) => {
          try {
            const result = await api.designPreview.read({
              cwd: workspaceRoot,
              threadId,
              relativePath: entry.relativePath,
            });
            return [entry.relativePath, result.contents] as const;
          } catch {
            return null;
          }
        }),
      );
      const map = new Map<string, string>();
      for (const pair of settled) {
        if (pair) map.set(pair[0], pair[1]);
      }
      return map;
    },
  });
  const inlinedAssets = assetsQuery.data ?? EMPTY_ASSET_MAP;

  const renderedContents = useMemo(() => {
    if (!selectedIsHtml || !contents) return contents;
    return inlineLocalAssets({
      html: contents,
      htmlPath: selectedPath ?? "",
      assets: inlinedAssets,
    });
  }, [contents, inlinedAssets, selectedIsHtml, selectedPath]);

  const openInNewTab =
    selectedIsHtml && renderedContents
      ? () => {
          const blob = new Blob([renderedContents], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank", "noopener,noreferrer");
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
      : null;

  const showViewportControls = selectedIsHtml && view === "preview" && hasEntries;
  const viewportWidth = viewport === "auto" ? null : VIEWPORT_WIDTHS[viewport];
  const canCopySource = Boolean(contents) && hasEntries && selectedPath !== null;
  const [justCopied, setJustCopied] = useState(false);

  // Measure the canvas frame so we can scale a fixed-viewport iframe down
  // to fit when the pane is narrower than the target width.
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameWidth, setFrameWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setFrameWidth(entry.contentRect.width);
    });
    observer.observe(node);
    setFrameWidth(node.getBoundingClientRect().width);
    return () => {
      observer.disconnect();
    };
  }, []);

  const scaleFactor = useMemo(() => {
    if (viewportWidth === null || frameWidth === null) return 1;
    // Subtract horizontal padding (32px) of the centering wrapper so the
    // scaled iframe doesn't push against the edges.
    const usable = Math.max(0, frameWidth - 32);
    if (usable <= 0) return 1;
    return Math.min(1, usable / viewportWidth);
  }, [viewportWidth, frameWidth]);

  // Brief "just updated" highlight whenever the iframe content reloads.
  const lastModifiedAtMs = selectedEntry?.modifiedAtMs ?? 0;
  const [flashKey, setFlashKey] = useState(0);
  const previousModifiedRef = useRef<number>(0);
  useEffect(() => {
    if (lastModifiedAtMs === 0) {
      previousModifiedRef.current = 0;
      return;
    }
    if (previousModifiedRef.current === 0) {
      previousModifiedRef.current = lastModifiedAtMs;
      return;
    }
    if (previousModifiedRef.current !== lastModifiedAtMs) {
      previousModifiedRef.current = lastModifiedAtMs;
      setFlashKey((k) => k + 1);
    }
  }, [lastModifiedAtMs]);
  const copySource = useCallback(() => {
    if (!contents) return;
    void navigator.clipboard
      .writeText(contents)
      .then(() => {
        setJustCopied(true);
        window.setTimeout(() => setJustCopied(false), 1200);
      })
      .catch(() => {
        // ignore — clipboard API may be blocked in some contexts
      });
  }, [contents]);

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
        <div className="flex shrink-0 items-center gap-1">
          {selectedIsHtml ? <ViewToggle view={view} onChange={setView} /> : null}
          {showViewportControls ? (
            <ViewportPicker viewport={viewport} onChange={setViewport} />
          ) : null}
          {(canCopySource || openInNewTab) && (selectedIsHtml || canCopySource) ? (
            <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          ) : null}
          {canCopySource ? (
            <button
              type="button"
              onClick={copySource}
              aria-label={justCopied ? "Copied" : "Copy source"}
              title={justCopied ? "Copied" : "Copy source"}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
            >
              {justCopied ? (
                <CheckIcon className="size-4 text-success" />
              ) : (
                <ClipboardIcon className="size-4" />
              )}
            </button>
          ) : null}
          {openInNewTab ? (
            <button
              type="button"
              onClick={openInNewTab}
              aria-label="Open in new tab"
              title="Open in new tab"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
            >
              <ArrowUpRightIcon className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => listQuery.refetch()}
            aria-label="Refresh"
            title="Refresh"
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
            ref={frameRef}
            className={cn(
              "relative flex min-h-0 flex-1 overflow-auto rounded-2xl",
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
                      width: `${viewportWidth * scaleFactor}px`,
                      height: `${(frameWidth ? frameWidth - 32 : viewportWidth) > 0 ? "100%" : "auto"}`,
                      minHeight: "100%",
                    }
              }
            >
              <iframe
                key={`${selectedPath}:${lastModifiedAtMs}`}
                title={`Preview of ${selectedPath}`}
                sandbox="allow-scripts allow-forms allow-popups"
                srcDoc={renderedContents}
                className="border-0 bg-white"
                style={
                  viewportWidth === null
                    ? { height: "100%", width: "100%" }
                    : {
                        width: `${viewportWidth}px`,
                        height: `${100 / scaleFactor}%`,
                        minHeight: `${100 / scaleFactor}%`,
                        transform: `scale(${scaleFactor})`,
                        transformOrigin: "top left",
                      }
                }
              />
            </div>
            {viewportWidth !== null && scaleFactor < 0.999 ? (
              <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-foreground/80 px-2 py-0.5 font-mono text-[10px] font-medium text-background shadow-soft">
                {Math.round(scaleFactor * 100)}%
              </div>
            ) : null}
            <CanvasUpdateFlash flashKey={flashKey} />
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

function CanvasUpdateFlash({ flashKey }: { flashKey: number }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (flashKey === 0) return;
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 600);
    return () => window.clearTimeout(timer);
  }, [flashKey]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 rounded-2xl ring-1 transition-opacity duration-500",
        active ? "opacity-100 ring-brand/60" : "opacity-0 ring-transparent",
      )}
    />
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
          Describe what you want in the chat. The canvas refreshes as the model writes the design.
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
