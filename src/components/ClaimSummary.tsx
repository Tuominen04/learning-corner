import type { Source } from "../lib/engine";
import { shortName } from "../lib/sources";

// What a document stands on, said at the top of it: how many claims it makes, the sources
// behind them, and how much you said you trust each one.
//
// Trust is shown in your own words, because that is how it is kept — "peer-reviewed", "the
// company selling it" — and not as a score the application worked out. A source you never
// said anything about is pointed out as such: a document leaning on six sources, one of them
// unexamined, should say so where you will see it.

/** "no claims", "1 claim", "4 claims". */
function count(n: number, noun: string): string {
  return n === 0 ? `no ${noun}s` : `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export function ClaimSummary({
  claims,
  sources,
  records,
  shown,
  onShow,
}: {
  claims: number;
  /** The sources the document cites, each once, in the order they first appear. */
  sources: string[];
  /** The library's sources, or `null` until they have been read. */
  records: Map<string, Source> | null;
  shown: boolean;
  onShow: (show: boolean) => void;
}) {
  return (
    <div className="claim-summary">
      <span className="claim-counts">
        {count(claims, "claim")} · {count(sources.length, "source")}
      </span>
      <button
        className={shown ? "tool on" : "tool"}
        aria-pressed={shown}
        onClick={() => onShow(!shown)}
        title="Mark the sentences that are anchored to a source"
      >
        Show claims
      </button>
      {sources.length > 0 && records !== null && (
        <ul className="claim-sources" aria-label="The sources this document draws on">
          {sources.map((id) => {
            const source = records.get(id);
            const trust = source?.appraisal?.trust?.trim();
            return (
              <li key={id}>
                <span className="who">
                  {source ? shortName(source) : "a source that no longer exists"}
                </span>
                {source && (
                  <span className={trust ? "trust" : "trust unrated"}>
                    {trust || "not rated"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
