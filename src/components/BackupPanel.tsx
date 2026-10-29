import { open as openFolder } from "@tauri-apps/plugin-dialog";
import { useState } from "react";

import { canKeepBoth, described, size, summary, unanswered } from "../lib/backup";
import {
  engine,
  EngineFailure,
  type BackupAnswer,
  type BackupApplied,
  type BackupEntry,
  type BackupPlan,
  type BackupSide,
} from "../lib/engine";
import { saveEverything } from "../lib/saving";

// Back up, bring back, restore — `backup-and-restore.md`, on screen.
//
// The library leads and the drive follows. Every one of the three is shown as a plan first and
// written only when somebody confirms it, so the panel is a folder choice, a plan to read, and
// one button. Closing it at any point before that button leaves both sides as they were.

export type BackupMode =
  /** The open library out to a drive. */
  | "backup"
  /** The drive's changes into the open library. */
  | "bring-back"
  /** A backup into an empty folder, as a library of its own. From the start screen. */
  | "restore";

const TITLES: Record<BackupMode, string> = {
  backup: "Back up",
  "bring-back": "Bring back from a drive",
  restore: "Restore from a backup",
};

export function BackupPanel({
  mode: initial,
  onApplied,
  onClose,
}: {
  mode: BackupMode;
  /** Something was written. After a bring-back or a restore, the library has changed. */
  onApplied: (applied: BackupApplied, mode: BackupMode) => void;
  onClose: () => void;
}) {
  // A backup that finds changes on the drive can turn into a bring-back from the same drive.
  const [mode, setMode] = useState<BackupMode>(initial);
  const [plan, setPlan] = useState<BackupPlan | null>(null);
  const [answers, setAnswers] = useState<Record<string, BackupAnswer>>({});
  const [overwrite, setOverwrite] = useState(false);
  const [applied, setApplied] = useState<BackupApplied | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attempt(work: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await work();
    } catch (thrown) {
      setError(thrown instanceof EngineFailure ? thrown.message : String(thrown));
    } finally {
      setBusy(false);
    }
  }

  function chooseDrive() {
    void attempt(async () => {
      const drive = await openFolder({
        directory: true,
        multiple: false,
        title:
          mode === "backup"
            ? "Choose the folder to back up to — an empty one, or an earlier backup of this library"
            : "Choose the backup's folder",
      });
      if (typeof drive !== "string") return; // dismissed the dialog
      let destination: string | null = null;
      if (mode === "restore") {
        const picked = await openFolder({
          directory: true,
          multiple: false,
          title: "Choose an empty folder to restore the library into",
        });
        if (typeof picked !== "string") return;
        destination = picked;
      }
      // The plan reads what is on disk, so the newest words go there first.
      if (mode !== "restore") await saveEverything();
      show(
        mode === "backup"
          ? await engine.backup.plan(drive)
          : await engine.backup.restorePlan(drive, destination),
      );
    });
  }

  function show(next: BackupPlan) {
    setPlan(next);
    setAnswers({});
    setOverwrite(false);
    setApplied(null);
  }

  function bringBackFirst() {
    if (plan === null) return;
    const drive = plan.drive_path;
    void attempt(async () => {
      setMode("bring-back");
      show(await engine.backup.restorePlan(drive));
    });
  }

  function apply() {
    if (plan === null) return;
    void attempt(async () => {
      await saveEverything();
      const done =
        plan.direction === "backup"
          ? await engine.backup.apply(overwrite)
          : await engine.backup.restoreApply(answers);
      setApplied(done);
      onApplied(done, mode);
    });
  }

  function close() {
    // The shell's copy of the plan is forgotten too; nothing was written.
    void engine.backup.cancel().catch(() => {});
    onClose();
  }

  const waiting = plan === null ? [] : unanswered(plan, answers);
  const needsOverwrite = plan !== null && plan.direction === "backup" && plan.drive_changes > 0;
  const ready =
    plan !== null &&
    plan.entries.length > 0 &&
    waiting.length === 0 &&
    (!needsOverwrite || overwrite);

  return (
    <div className="confirm backup-panel">
      <header>
        <h3>{TITLES[mode]}</h3>
      </header>

      {applied ? (
        <Applied applied={applied} mode={mode} />
      ) : plan === null ? (
        <Intro mode={mode} />
      ) : (
        <>
          <p className="where">
            {plan.direction === "backup" ? "To " : "From "}
            <code>{plan.drive_path}</code>
            {plan.direction === "restore" && (
              <>
                {" "}
                into <code>{plan.library_path}</code>
              </>
            )}
          </p>
          <p role="status">
            <strong>{summary(plan)}</strong>
            {plan.unchanged > 0 && ` ${plan.unchanged} already the same on both sides.`}
          </p>
          {plan.direction === "backup" && !plan.known_drive && plan.entries.length > 0 && (
            <p className="hint">This folder has not been backed up to before.</p>
          )}

          {needsOverwrite && (
            <div className="warning drive-changes">
              <p>
                The drive has {plan.drive_changes} change{plan.drive_changes === 1 ? "" : "s"} of
                its own — made on another computer, perhaps. Backing up replaces them with this
                library's versions.
              </p>
              <div className="row">
                <button className="secondary" onClick={bringBackFirst} disabled={busy}>
                  Bring them back first
                </button>
              </div>
              <label className="choice">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                <span>
                  <strong>Replace them</strong>
                  The drive's versions are kept in this library's <code>.conflicts</code> folder
                  first, so nothing is lost.
                </span>
              </label>
            </div>
          )}

          {plan.entries.length > 0 && (
            <ul className="backup-entries">
              {plan.entries.map((entry) => (
                <Entry
                  key={entry.path}
                  entry={entry}
                  answer={answers[entry.path]}
                  onAnswer={(a) => setAnswers((was) => ({ ...was, [entry.path]: a }))}
                  disabled={busy}
                />
              ))}
            </ul>
          )}
          {waiting.length > 0 && (
            <p className="hint">
              {waiting.length} file{waiting.length === 1 ? " needs" : "s need"} an answer first.
            </p>
          )}
        </>
      )}

      {error && <p className="error">{error}</p>}

      <div className="row">
        {applied ? (
          <button onClick={onClose} autoFocus>
            Done
          </button>
        ) : plan === null ? (
          <button onClick={chooseDrive} disabled={busy} autoFocus>
            {busy ? "Looking…" : "Choose a folder…"}
          </button>
        ) : (
          <>
            <button onClick={apply} disabled={busy || !ready}>
              {busy ? "Working…" : TITLES[mode]}
            </button>
            <button className="secondary" onClick={chooseDrive} disabled={busy}>
              Another folder…
            </button>
          </>
        )}
        {!applied && (
          <button className="secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function Intro({ mode }: { mode: BackupMode }) {
  switch (mode) {
    case "backup":
      return (
        <p>
          Makes a folder — on a USB drive, say — exactly like this library. Choose an empty
          folder the first time, and the same folder after that. You are shown what would
          change before anything does.
        </p>
      );
    case "bring-back":
      return (
        <p>
          Copies what was changed on a backup — on another computer, say — into this library.
          You are asked only about a file changed in both places. Whatever this library had is
          kept in its <code>.conflicts</code> folder before it is replaced.
        </p>
      );
    case "restore":
      return (
        <p>
          Makes a library from a backup, in an empty folder you choose: first the backup's
          folder, then where to put the library. It opens when it is done.
        </p>
      );
  }
}

function Entry({
  entry,
  answer,
  onAnswer,
  disabled,
}: {
  entry: BackupEntry;
  answer: BackupAnswer | undefined;
  onAnswer: (answer: BackupAnswer) => void;
  disabled: boolean;
}) {
  return (
    <li className={entry.action === "ask" ? "ask" : undefined}>
      <code>{entry.path}</code> <span className="outcome">{described(entry.outcome)}</span>
      {entry.action === "leave" && <span className="hint"> — goes out with the next backup</span>}
      {entry.action === "ask" && (
        <div className="answers" role="radiogroup" aria-label={`What to do with ${entry.path}`}>
          <p className="hint">
            Here: <Version side={entry.library} /> · On the drive: <Version side={entry.drive} />
          </p>
          <Choice
            name={entry.path}
            checked={answer === "keep-library"}
            onChange={() => onAnswer("keep-library")}
            disabled={disabled}
            label="Keep this library's"
            hint="The next backup takes it to the drive."
          />
          <Choice
            name={entry.path}
            checked={answer === "take-drive"}
            onChange={() => onAnswer("take-drive")}
            disabled={disabled}
            label="Take the drive's"
            hint="This library's is kept in .conflicts first."
          />
          {canKeepBoth(entry) && (
            <Choice
              name={entry.path}
              checked={answer === "keep-both"}
              onChange={() => onAnswer("keep-both")}
              disabled={disabled}
              label="Keep both"
              hint="The drive's goes beside this one, named “(from backup …)”."
            />
          )}
        </div>
      )}
    </li>
  );
}

function Choice(props: {
  name: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  label: string;
  hint: string;
}) {
  return (
    <label className="choice">
      <input
        type="radio"
        name={props.name}
        checked={props.checked}
        onChange={props.onChange}
        disabled={props.disabled}
      />
      <span>
        <strong>{props.label}</strong>
        {props.hint}
      </span>
    </label>
  );
}

function Version({ side }: { side: BackupSide | null }) {
  if (side === null) return <>removed</>;
  const when = side.modified ? new Date(side.modified) : null;
  return (
    <>
      {size(side.size)}
      {when && !Number.isNaN(when.getTime()) && `, changed ${when.toLocaleString()}`}
    </>
  );
}

function Applied({ applied, mode }: { applied: BackupApplied; mode: BackupMode }) {
  const copied = applied.copied.length;
  const removed = applied.removed.length;
  return (
    <>
      <p role="status">
        <strong>
          {mode === "backup" ? "Backed up" : mode === "restore" ? "Restored" : "Brought back"}:
        </strong>{" "}
        {copied} file{copied === 1 ? "" : "s"} copied, {removed} removed.
      </p>
      {applied.kept.length > 0 && (
        <>
          <p>The versions that were replaced are kept in this library:</p>
          <ul className="backup-entries">
            {applied.kept.map((path) => (
              <li key={path}>
                <code>{path}</code>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
