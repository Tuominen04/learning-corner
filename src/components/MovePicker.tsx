import { useState } from "react";

import type { Topic } from "../lib/engine";
import { destinations, nameOf, placeName, placeOf, type Moving, type Place } from "../lib/moving";

// Moving something, having chosen where to: what the move button opens.
//
// Every topic is listed, in the sidebar's order, the ones it cannot go to included and saying
// why — a topic missing from the list looks like a topic that has gone. Nothing moves until
// Move is pressed.

export function MovePicker({
  what,
  topics,
  onMove,
  onCancel,
}: {
  what: Moving;
  topics: Topic[];
  onMove: (to: Place) => void;
  onCancel: () => void;
}) {
  // `undefined` until something is chosen; `null` is the top level, which is a choice.
  const [to, setTo] = useState<Place | undefined>(undefined);
  const here = placeOf(topics, what);

  return (
    <section className="move-picker">
      <h2>Move “{nameOf(what)}”</h2>
      <p>
        It is in {here === undefined ? "the library" : placeName(topics, here)}. Choose where it
        goes.
      </p>
      <p className="hint">
        {what.kind === "document"
          ? "Its pictures go with it."
          : "Everything inside it goes with it, however deep."}{" "}
        Links and citations keep working: they point at what they mean, not at where it is.
      </p>

      <ul className="places" role="radiogroup" aria-label="Where it goes">
        {destinations(topics, what).map((place) => (
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
