import { memo, type ReactNode } from "react";
import { EllipsisIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Menu, MenuPopup, MenuTrigger } from "../ui/menu";

// Design-only build: renders the provider traits menu when it exists,
// and disappears otherwise.
export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  traitsMenuContent?: ReactNode;
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
