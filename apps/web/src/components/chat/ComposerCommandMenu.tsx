import {
  type ProjectEntry,
  type ProviderKind,
  type ServerProviderSlashCommand,
} from "@dh/contracts";
import { BotIcon } from "lucide-react";
import { memo, useLayoutEffect, useMemo, useRef } from "react";

import { type ComposerSlashCommand, type ComposerTriggerKind } from "../../composer-logic";
import { cn } from "~/lib/utils";
import {
  Command,
  CommandGroup,
  CommandGroupLabel,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";
import { VscodeEntryIcon } from "./VscodeEntryIcon";

export type ComposerCommandItem =
  | {
      id: string;
      type: "path";
      path: string;
      pathKind: ProjectEntry["kind"];
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "slash-command";
      command: ComposerSlashCommand;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "provider-slash-command";
      provider: ProviderKind;
      command: ServerProviderSlashCommand;
      label: string;
      description: string;
    };

type ComposerCommandGroup = {
  id: string;
  label: string | null;
  items: ComposerCommandItem[];
};

function ProviderGlyph(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function groupCommandItems(
  items: ComposerCommandItem[],
  triggerKind: ComposerTriggerKind | null,
  groupSlashCommandSections: boolean,
): ComposerCommandGroup[] {
  if (triggerKind !== "slash-command" || !groupSlashCommandSections) {
    return [{ id: "default", label: null, items }];
  }

  const builtInItems = items.filter((item) => item.type === "slash-command");
  const providerItems = items.filter((item) => item.type === "provider-slash-command");

  const groups: ComposerCommandGroup[] = [];
  if (builtInItems.length > 0) {
    groups.push({ id: "built-in", label: "Built-in", items: builtInItems });
  }
  if (providerItems.length > 0) {
    groups.push({ id: "provider", label: "Provider", items: providerItems });
  }
  return groups;
}

export const ComposerCommandMenu = memo(function ComposerCommandMenu(props: {
  items: ComposerCommandItem[];
  resolvedTheme: "light" | "dark";
  isLoading: boolean;
  triggerKind: ComposerTriggerKind | null;
  groupSlashCommandSections?: boolean;
  emptyStateText?: string;
  activeItemId: string | null;
  onHighlightedItemChange: (itemId: string | null) => void;
  onSelect: (item: ComposerCommandItem) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(
    () =>
      groupCommandItems(props.items, props.triggerKind, props.groupSlashCommandSections ?? true),
    [props.groupSlashCommandSections, props.items, props.triggerKind],
  );

  useLayoutEffect(() => {
    if (!props.activeItemId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-composer-item-id="${CSS.escape(props.activeItemId)}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [props.activeItemId]);

  return (
    <Command
      autoHighlight={false}
      mode="none"
      onItemHighlighted={(highlightedValue) => {
        props.onHighlightedItemChange(
          typeof highlightedValue === "string" ? highlightedValue : null,
        );
      }}
    >
      <div
        ref={listRef}
        className="relative overflow-hidden rounded-xl border border-border/80 bg-popover/96 shadow-lg/8 backdrop-blur-xs"
      >
        <CommandList className="max-h-72">
          {groups.map((group, groupIndex) => (
            <div key={group.id}>
              {groupIndex > 0 ? <CommandSeparator className="my-0.5" /> : null}
              <CommandGroup>
                {group.label ? (
                  <CommandGroupLabel className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/55">
                    {group.label}
                  </CommandGroupLabel>
                ) : null}
                {group.items.map((item) => (
                  <ComposerCommandMenuItem
                    key={item.id}
                    item={item}
                    resolvedTheme={props.resolvedTheme}
                    isActive={props.activeItemId === item.id}
                    onHighlight={props.onHighlightedItemChange}
                    onSelect={props.onSelect}
                  />
                ))}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
        {props.items.length === 0 ? (
          <div className="px-3 py-2">
            <p className="text-muted-foreground/70 text-xs">
              {props.isLoading
                ? "Searching workspace files..."
                : (props.emptyStateText ??
                  (props.triggerKind === "path"
                    ? "No matching files or folders."
                    : "No matching command."))}
            </p>
          </div>
        ) : null}
      </div>
    </Command>
  );
});

const ComposerCommandMenuItem = memo(function ComposerCommandMenuItem(props: {
  item: ComposerCommandItem;
  resolvedTheme: "light" | "dark";
  isActive: boolean;
  onHighlight: (itemId: string | null) => void;
  onSelect: (item: ComposerCommandItem) => void;
}) {
  return (
    <CommandItem
      value={props.item.id}
      data-composer-item-id={props.item.id}
      className={cn(
        "cursor-pointer select-none gap-2 hover:bg-transparent hover:text-inherit data-highlighted:bg-transparent data-highlighted:text-inherit",
        props.isActive && "bg-accent! text-accent-foreground!",
      )}
      onMouseMove={() => {
        if (!props.isActive) props.onHighlight(props.item.id);
      }}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        props.onSelect(props.item);
      }}
    >
      {props.item.type === "path" ? (
        <VscodeEntryIcon
          pathValue={props.item.path}
          kind={props.item.pathKind}
          theme={props.resolvedTheme}
        />
      ) : null}
      {props.item.type === "slash-command" ? (
        <BotIcon className="size-4 shrink-0 text-muted-foreground/80" />
      ) : null}
      {props.item.type === "provider-slash-command" ? (
        <span className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground/80">
          <ProviderGlyph className="size-3.5" />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0">{props.item.label}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground/70 text-xs">
          {props.item.description}
        </span>
      </span>
    </CommandItem>
  );
});
