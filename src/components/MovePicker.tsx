import { useState } from "react";

import type { Page } from "../lib/engine";
import { destinations, nameOf, parentOf, placeName, type Moving, type Place } from "../lib/moving";

// Moving something, having chosen where to: what the move button opens.
//
// Choosing which page it goes under, at the end of the pages there. Every page is listed, in
// the sidebar's order, the ones it cannot go under included and saying why — a page missing
// from the list looks like a page that has gone. Nothing moves until Move is pressed. Its place
// among its new siblings is then a drag or Alt+↑/↓ away.

export function MovePicker({
  what,
  pages,
  onMove,
  onCancel,
}: {
  what: Moving;
  pages: Page[];
  onMove: (to: Place) => void;
  onCancel: () => void;
}) {
  // `undefined` until something is chosen; `null` is the top level, which is a choice.
  const [to, setTo] = useState<Place | undefined>(undefined);
  const here = parentOf(pages, what.id);

  return (
    <section className="move-picker">
      <h2>Move “{nameOf(what)}”</h2>
      <p>
        It is {here === undefined ? "in the library" : here === null ? "at the top level" : `under ${placeName(pages, here)}`}.
        Choose what it goes under.
      </p>
      <p className="hint">
        Every page under it goes with it, however deep, and its pictures with it.{" "}
        Links and citations keep working: they point at what they mean, not at where it is.
      </p>

      <ul className="places" role="radiogroup" aria-label="Where it goes">
        {destinations(pages, what).map((place) => (
          <li key={place.place ?? ""} style={{ paddingLeft: `${place.depth * 1.2}rem` }}>
            <label className={place.reason ? "choice unavailable" : "choice"}>
              <input
                type="radio"
                name="move-to"
                checked={to === place.place}
                disabled={place.reason !== null}
                onChange={() => setTo(place.place)}
              />
              <span>
                <strong>{place.name}</strong>
                {place.reason}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="row">
        <button onClick={() => to !== undefined && onMove(to)} disabled={to === undefined}>
          Move
        </button>
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
