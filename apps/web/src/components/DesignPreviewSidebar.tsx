import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLinkIcon,
  FileIcon,
  PaletteIcon,
  PanelRightCloseIcon,
  RefreshCwIcon,
} from "lucide-react";
import type { DesignPreviewEntry, EnvironmentId, ThreadId } from "@t3tools/contracts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
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
  onClose?: () => void;
}

function isHtmlFile(path: string): boolean {
  return /\.(html?|htm)$/i.test(path);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DesignPreviewSidebar = memo(function DesignPreviewSidebar({
  environmentId,
  threadId,
  workspaceRoot,
  mode = "sidebar",
  onClose,
}: DesignPreviewSidebarProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

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
  const rootExists = listQuery.data?.rootExists;
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

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-card/50",
        mode === "sidebar"
          ? "h-full w-[560px] shrink-0 border-l border-border/70"
          : mode === "pane"
            ? "h-full w-full"
            : "h-full w-full",
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="rounded-md bg-pink-400/10 px-1.5 py-0 text-[10px] font-semibold tracking-wide text-pink-400 uppercase"
          >
            <PaletteIcon className="mr-1 inline size-3" />
            Preview
          </Badge>
          <span className="text-[11px] text-muted-foreground/60">
            {entries.length === 0
              ? "No files yet"
              : `${entries.length} file${entries.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => listQuery.refetch()}
            aria-label="Refresh design files"
            className="text-muted-foreground/50 hover:text-foreground/70"
          >
            <RefreshCwIcon className={cn("size-3.5", listQuery.isFetching && "animate-spin")} />
          </Button>
          {mode !== "pane" && onClose ? (
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onClose}
              aria-label="Close design sidebar"
              className="text-muted-foreground/50 hover:text-foreground/70"
            >
              <PanelRightCloseIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Horizontal tab strip for design files */}
        {entries.length > 0 ? (
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 px-2 py-1.5">
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
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors",
                    isActive
                      ? "bg-pink-400/10 text-foreground"
                      : "text-muted-foreground/70 hover:bg-muted/30 hover:text-foreground/90",
                  )}
                >
                  <FileIcon
                    className={cn(
                      "size-3 shrink-0",
                      isActive ? "text-pink-400" : "text-muted-foreground/50",
                    )}
                  />
                  <span className="max-w-[140px] truncate">{entry.name}</span>
                  {!isHtml ? (
                    <span className="text-[9px] text-muted-foreground/40">txt</span>
                  ) : null}
                </button>
              );
            })}
            {selectedIsHtml && contents ? (
              <div className="ml-auto shrink-0">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Open preview in new tab"
                  className="text-muted-foreground/50 hover:text-foreground/70"
                  onClick={() => {
                    const blob = new Blob([contents], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank", "noopener,noreferrer");
                    setTimeout(() => URL.revokeObjectURL(url), 60_000);
                  }}
                >
                  <ExternalLinkIcon className="size-3.5" />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Empty / error states replace the preview area entirely when no files */}
        {entries.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-8">
            {listQuery.isError ? (
              <div className="max-w-sm text-center text-xs text-rose-400">
                <div className="font-medium">Failed to load design files.</div>
                <div className="mt-1 break-words text-[10px] text-rose-400/80">
                  {listQuery.error instanceof Error
                    ? listQuery.error.message
                    : String(listQuery.error ?? "")}
                </div>
                {resolvedAbsolutePath ? (
                  <div className="mt-3 break-all text-[10px] text-muted-foreground/50">
                    {resolvedAbsolutePath}
                  </div>
                ) : null}
              </div>
            ) : listQuery.isPending ? (
              <div className="text-xs text-muted-foreground/60">Loading…</div>
            ) : (
              <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-pink-400/20 bg-pink-400/5">
                  <PaletteIcon className="size-6 text-pink-400/70" aria-hidden />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-foreground/80">
                    Your design will appear here
                  </div>
                  <div className="text-xs text-muted-foreground/60">
                    Describe what you want in the chat. The preview updates live as the model writes
                    HTML.
                  </div>
                </div>
                {resolvedAbsolutePath ? (
                  <div className="mt-1 break-all text-[10px] text-muted-foreground/30">
                    {resolvedAbsolutePath}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {/* Preview pane — only when there are files */}
        {entries.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col bg-background">
            {!selectedPath ? (
              <div className="flex h-full items-center justify-center px-6 text-xs text-muted-foreground/50">
                Select a file to preview.
              </div>
            ) : readQuery.isPending ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50">
                Loading…
              </div>
            ) : readQuery.isError ? (
              <div className="flex h-full items-center justify-center text-xs text-rose-400">
                Failed to load file.
              </div>
            ) : selectedIsHtml ? (
              <iframe
                key={`${selectedPath}:${selectedEntry?.modifiedAtMs ?? 0}`}
                title={`Preview of ${selectedPath}`}
                sandbox="allow-scripts allow-forms allow-popups"
                srcDoc={contents}
                className="h-full w-full border-0 bg-white"
              />
            ) : (
              <ScrollArea className="h-full">
                <pre className="whitespace-pre-wrap break-words p-3 text-[11px] text-foreground/90">
                  {contents}
                </pre>
              </ScrollArea>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default DesignPreviewSidebar;
