import { useEffect, useRef, useState } from "react";

/**
 * A small menu anchored to a button.
 *
 * Used for the canvas tile's "..." menu
 * the same way: Rename and Delete on one tile.
 */
export const TileMenu = ({
  label,
  items,
}: {
  label: string;
  items: Array<{ key: string; label: string; danger?: boolean; onSelect: () => void }>;
}) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="tile-menu" ref={root}>
      <button
        type="button"
        className="ghost sm"
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        …
      </button>
      {open ? (
        <div className="menu" role="menu">
          {items.map((item) => (
            <button
              type="button"
              key={item.key}
              role="menuitem"
              className={item.danger ? "danger" : undefined}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
