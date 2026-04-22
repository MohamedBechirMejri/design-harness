import { ProviderInteractionMode, RuntimeMode } from "@t3tools/contracts";
import { memo, type ReactNode } from "react";
import { EllipsisIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Menu, MenuPopup, MenuTrigger } from "../ui/menu";

// Design-only build: mode/runtime/plan/design toggles have all been
// removed. This component now only renders the ellipsis menu when there
// is provider-specific traits content to show.
export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  activePlan?: boolean;
  interactionMode?: ProviderInteractionMode;
  planSidebarLabel?: string;
  planSidebarOpen?: boolean;
  runtimeMode?: RuntimeMode;
  showInteractionModeToggle?: boolean;
  showDesignModeToggle?: boolean;
  showDesignSidebarToggle?: boolean;
  designSidebarOpen?: boolean;
  traitsMenuContent?: ReactNode;
  onToggleInteractionMode?: () => void;
  onToggleDesignMode?: () => void;
  onTogglePlanSidebar?: () => void;
  onToggleDesignSidebar?: () => void;
  onRuntimeModeChange?: (mode: RuntimeMode) => void;
}) {
  if (!props.traitsMenuContent) return null;
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 px-2 text-muted-foreground/70 hover:text-foreground/80"
            aria-label="More composer controls"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" className="size-4" />
      </MenuTrigger>
      <MenuPopup align="start">{props.traitsMenuContent}</MenuPopup>
    </Menu>
  );
});
