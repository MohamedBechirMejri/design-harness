import { memo, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLinkIcon,
  FileIcon,
  FolderIcon,
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
  mode?: "sheet" | "sidebar";
  onClose: () => void;
}

interface TreeDirectory {
  name: string;
  path: string;
  directories: TreeDirectory[];
  files: DesignPreviewEntry[];
}

function sortTreeDirectory(dir: TreeDirectory): void {
  dir.directories.sort((a, b) => a.name.localeCompare(b.name));
  dir.files.sort((a, b) => a.name.localeCompare(b.name));
  for (const child of dir.directories) sortTreeDirectory(child);
}

function buildTree(entries: ReadonlyArray<DesignPreviewEntry>): TreeDirectory {
  const root: TreeDirectory = { name: "", path: "", directories: [], files: [] };
  for (const entry of entries) {
    const parts = entry.relativePath.split("/");
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const segment = parts[i]!;
      const existing = cursor.directories.find((d) => d.name === segment);
      if (existing) {
        cursor = existing;
      } else {
        const next: TreeDirectory = {
          name: segment,
          path: parts.slice(0, i + 1).join("/"),
          directories: [],
          files: [],
        };
        cursor.directories.push(next);
        cursor = next;
      }
    }
    cursor.files.push(entry);
  }
  sortTreeDirectory(root);
  return root;
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
  const htmlEntries = useMemo(
    () => entries.filter((entry) => isHtmlFile(entry.relativePath)),
    [entries],
  );
  const tree = useMemo(() => buildTree(entries), [entries]);

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
            Design
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
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onClose}
            aria-label="Close design sidebar"
            className="text-muted-foreground/50 hover:text-foreground/70"
          >
            <PanelRightCloseIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[200px] shrink-0 flex-col border-r border-border/60">
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-2">
              {entries.length === 0 ? (
                listQuery.isError ? (
                  <div className="px-2 py-4 text-left text-xs text-rose-400">
                    <div className="font-medium">Failed to list design files.</div>
                    <div className="mt-1 break-words text-[10px] text-rose-400/80">
                      {listQuery.error instanceof Error
                        ? listQuery.error.message
                        : String(listQuery.error ?? "")}
                    </div>
                    {workspaceRoot ? (
                      <div
                        className="mt-2 break-all text-[10px] text-muted-foreground/50"
                        title={`${workspaceRoot}/.t3code/design/${threadId}`}
                      >
                        {workspaceRoot}/.t3code/design/{threadId}
                      </div>
                    ) : null}
                  </div>
                ) : listQuery.isPending ? (
                  <div className="px-2 py-6 text-center text-xs text-muted-foreground/60">
                    Loading…
                  </div>
                ) : (
                  <div className="px-2 py-4 text-left text-xs text-muted-foreground/60">
                    <div>No design files here yet.</div>
                    {workspaceRoot ? (
                      <div
                        className="mt-2 break-all text-[10px] text-muted-foreground/40"
                        title={`${workspaceRoot}/.t3code/design/${threadId}`}
                      >
                        Looking in{" "}
                        <span className="text-muted-foreground/60">
                          .t3code/design/{threadId}
                        </span>
                      </div>
                    ) : null}
                  </div>
                )
              ) : (
                <DesignPreviewTree
                  tree={tree}
                  selectedPath={selectedPath}
                  onSelect={setSelectedPath}
                />
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground/70">
            <div className="min-w-0 truncate">
              {selectedEntry ? (
                <span title={selectedEntry.relativePath}>
                  {selectedEntry.relativePath}
                  <span className="ml-2 text-muted-foreground/40">
                    {formatSize(selectedEntry.size)}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground/40">No file selected</span>
              )}
            </div>
            {selectedIsHtml && contents ? (
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
            ) : null}
          </div>

          <div className="min-h-0 flex-1 bg-background">
            {!selectedPath ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50">
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
        </div>
      </div>
    </div>
  );
});

function DesignPreviewTree(props: {
  tree: TreeDirectory;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  return <DesignPreviewTreeNode {...props} dir={props.tree} depth={0} />;
}

function DesignPreviewTreeNode(props: {
  dir: TreeDirectory;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const { dir, depth, selectedPath, onSelect } = props;
  return (
    <div className="flex flex-col">
      {dir.directories.map((child) => (
        <div key={child.path} className="flex flex-col">
          <div
            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-muted-foreground/70"
            style={{ paddingLeft: `${depth * 10 + 6}px` }}
          >
            <FolderIcon className="size-3 shrink-0" />
            <span className="truncate">{child.name}</span>
          </div>
          <DesignPreviewTreeNode
            dir={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        </div>
      ))}
      {dir.files.map((file) => {
        const active = selectedPath === file.relativePath;
        return (
          <button
            key={file.relativePath}
            type="button"
            onClick={() => onSelect(file.relativePath)}
            className={cn(
              "flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] transition-colors",
              active
                ? "bg-pink-400/10 text-foreground"
                : "text-muted-foreground/80 hover:bg-muted/30 hover:text-foreground/90",
            )}
            style={{ paddingLeft: `${depth * 10 + 6}px` }}
            title={file.relativePath}
          >
            <FileIcon
              className={cn(
                "size-3 shrink-0",
                active ? "text-pink-400" : "text-muted-foreground/50",
              )}
            />
            <span className="truncate">{file.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export default DesignPreviewSidebar;
