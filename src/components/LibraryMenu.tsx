import { useEffect, useRef, useState } from "react";

// What you do to the library as a whole — back it up, bring changes back, close it for another
// — gathered behind one button at the top left, where an application keeps such things. They
// were loose text under the name before, and read as captions rather than as things to press.
//
// A disclosure, not an ARIA menu: a button that shows a short list of ordinary buttons. Tab
// moves through them, Escape or a click anywhere else closes it, and choosing one closes it.

export interface LibraryAction {
  label: string;
  title: string;
  onChoose: () => void;
  disabled?: boolean;
}

export function LibraryMenu({ actions }: { actions: LibraryAction[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className="library-menu" ref={root}>
      <button
        ref={toggle}
        className="ghost menu-toggle"
        aria-expanded={open}
        aria-controls="library-menu-list"
        aria-label="Library menu"
        title="Back up, bring back, or switch library"
        onClick={() => setOpen((was) => !was)}
      >
        ☰
      </button>
      {open && (
        <ul className="menu-list" id="library-menu-list">
          {actions.map((action) => (
            <li key={action.label}>
              <button
                className="ghost"
                title={action.title}
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onChoose();
                }}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
