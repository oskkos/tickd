import { useEffect, useState } from 'react';
import { db } from '../../db/schema.ts';
import { currentPersistence, type PersistState } from '../../db/persist.ts';
import { deleteLogbook, replaceLogbook, type LogbookPayload } from '../../db/logbook.ts';
import { ThemeControl } from './ThemeControl.tsx';
import { HapticControl } from './HapticControl.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import {
  buildExport,
  downloadExport,
  exportFileName,
  parseImport,
  type ImportRefusal,
  type LogbookCounts,
} from './logbookFile.ts';

/**
 * Appearance, then the logbook, then the one irreversible thing.
 *
 * **The order is the design.** What is touched often sits above what is touched rarely, and the
 * destructive action sits below both so that it is never adjacent to a control reached by habit — on a
 * surface used one-handed, adjacency is the whole risk.
 *
 * What the mock (`7-settings.png`) shows and this deliberately does not:
 *
 * - **Grade grid order.** `DESIGN.md` §5 settled it easiest-at-top, and the grid renders `grade-spec`'s
 *   storage order to make reversal not arise. A control would re-open a closed decision, per user.
 * - **Send style.** Derived, never stored (D20). The mock renders the toggle disabled and explains why;
 *   that explanation became the model.
 * - **Default protection.** Already obsolete: `LoggingScreen` seeds discipline and protection from the
 *   session's own newest tick, so a preference would govern only the first go of a session. The better
 *   fix — seeding that first go from the last go anywhere — needs no setting, and is not this change.
 */

/** A titled block. Sections are plain headings rather than cards: this is a list of settings. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="shrink-0">
      <h3 className="mb-2 text-xs uppercase tracking-wide opacity-50">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** A labelled row with its control beneath — stacked, because a 48px control needs the width. */
function Setting({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-box bg-base-200/40 p-3">
      <p className="mb-2 text-sm font-semibold">{label}</p>
      {description !== undefined && <p className="mb-2 text-xs opacity-70">{description}</p>}
      {children}
    </div>
  );
}

/**
 * What the browser is doing about eviction, and what the user can do about it.
 *
 * Three states rather than a boolean, because **the advice differs**: an unpersisted origin is usually
 * fixed by installing to the home screen, and an unsupporting one is Safari, where the protection is
 * instead that an installed PWA escapes the seven-day unused-data clear (`CONCEPT.md` §7.6).
 *
 * Deliberately not raised to a shell banner. `StorageWarning` means *cannot save at all*; this means
 * *can save, might later be evicted*, which is a different severity — and a banner shown every launch in
 * a browser that never grants persistence is invisible by the third day.
 */
function storageMessage(state: PersistState): { headline: string; detail: string } {
  switch (state) {
    case 'persisted':
      return {
        headline: 'Protected from automatic cleanup',
        detail:
          'The browser has agreed not to evict this logbook when storage runs low. Export anyway — this is not a backup.',
      };
    case 'unpersisted':
      return {
        headline: 'Not protected',
        detail:
          'The browser may delete this logbook if storage runs low. Installing tickd to your home screen usually earns it protection.',
      };
    case 'unsupported':
      return {
        headline: 'This browser cannot protect it',
        detail:
          'Safari does not offer storage protection. Keeping tickd on your home screen is what stops it clearing unused data.',
      };
    case 'unknown':
      return {
        headline: 'Could not tell',
        detail: 'The browser did not answer. Export occasionally and it will not matter.',
      };
  }
}

/**
 * Why a file was refused, in words that name the cause rather than the category.
 *
 * "Invalid file" would be true of all three and useful for none. A marker mismatch is a version
 * difference and the file is fine; a digest mismatch means the file was edited and *that* is the thing
 * to know; an unparseable file is usually the wrong file entirely.
 */
function refusalMessage(refusal: ImportRefusal): string {
  switch (refusal) {
    case 'unparseable':
      return 'That is not a tickd export.';
    case 'marker':
      return 'That export came from a different version of tickd. Exports are never upgraded — a schema change means starting fresh, which is why this phase keeps no migrations.';
    case 'digest':
      return 'That file has been modified since it was exported, so tickd will not import it.';
  }
}

function countsLabel(counts: LogbookCounts): string {
  const ticks = `${String(counts.ticks)} ${counts.ticks === 1 ? 'tick' : 'ticks'}`;
  const sessions = `${String(counts.sessions)} ${counts.sessions === 1 ? 'session' : 'sessions'}`;
  return `${ticks} in ${sessions}, on this phone only`;
}

/** A file that has passed every check and is waiting to be confirmed. */
interface PendingImport {
  readonly payload: LogbookPayload;
  readonly counts: LogbookCounts;
  readonly exported_at: string;
}

export function SettingsScreen({
  /**
   * Fixed only by tests. Left undefined, the export is stamped **when the button is pressed** rather
   * than when the screen mounted — measured in a browser, where a file exported minutes after opening
   * settings carried the mount's timestamp. Harmless until a session spans midnight, at which point the
   * file is named for yesterday and its `exported_at` disagrees with the day it was taken.
   */
  now,
  /**
   * Injected so a test can observe it, and named for what it is rather than hidden behind an effect.
   *
   * **The reload is load-bearing twice over.** Every screen in this app reads into `useState` in an
   * effect — there is no `useLiveQuery` anywhere — so after the database is replaced or emptied, the
   * mounted surfaces are showing rows that no longer exist and nothing invalidates them. And the reload
   * re-runs `initialiseStorage`, which re-applies `seedVenues` over whatever venues the file carried,
   * so the current seed set reasserts itself without an import-specific reseed step.
   */
  reload = () => {
    globalThis.location.reload();
  },
}: {
  now?: Date;
  reload?: () => void;
}) {
  const [storage, setStorage] = useState<PersistState | undefined>();
  const [counts, setCounts] = useState<LogbookCounts | undefined>();
  const [pending, setPending] = useState<PendingImport | undefined>();
  const [refusal, setRefusal] = useState<ImportRefusal | undefined>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    void currentPersistence().then(setStorage);
  }, []);

  useEffect(() => {
    void Promise.all([db.venues.count(), db.sessions.count(), db.ticks.count()]).then(
      ([venues, sessions, ticks]) => {
        setCounts({ venues, sessions, ticks });
      },
      (error: unknown) => {
        // The storage warning in the shell already says the database is unusable; this section simply
        // has nothing to report rather than blocking the rest of the screen.
        console.error('[tickd] could not count the logbook', error);
      },
    );
  }, []);

  async function onExport() {
    const at = now ?? new Date();
    downloadExport(await buildExport(db, at), exportFileName(at));
  }

  /**
   * Validate, then confirm — never the other way round.
   *
   * A refused file must not reach a dialog. Ordering it the other way produces the worst version of this
   * screen: a confirmation promising to replace 412 ticks, followed by a failure.
   */
  async function onFileChosen(file: File) {
    setRefusal(undefined);
    const result = parseImport(await file.text());
    if (!result.ok) {
      setRefusal(result.refusal);
      return;
    }
    setPending({ payload: result.payload, counts: result.counts, exported_at: result.exported_at });
  }

  async function onConfirmImport(accepted: PendingImport) {
    await replaceLogbook(db, accepted.payload);
    reload();
  }

  async function onConfirmDelete() {
    await deleteLogbook(db);
    reload();
  }

  const storageState = storage === undefined ? undefined : storageMessage(storage);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      <h2 className="shrink-0 text-2xl">Settings</h2>

      <Section title="Appearance">
        <Setting label="Theme">
          <ThemeControl />
        </Setting>
      </Section>

      <Section title="Feedback">
        <Setting
          label="Vibrate on each go"
          description="A short buzz when a go is written. Gloves and gym noise; the visible confirmation stays either way."
        >
          <HapticControl />
        </Setting>
      </Section>

      <Section title="Your data">
        <div className="rounded-box bg-base-200/40 p-3">
          <p className="text-sm font-semibold">
            {counts === undefined ? 'Counting…' : countsLabel(counts)}
          </p>
          {storageState !== undefined && (
            <p className="mt-2 text-xs opacity-70">
              <span className="font-semibold">{storageState.headline}.</span> {storageState.detail}
            </p>
          )}
          <p className="mt-2 text-xs opacity-70">
            Phase 0 keeps nothing on a server, by design. An export is the only copy that survives
            this phone.
          </p>
          <button
            type="button"
            onClick={() => void onExport()}
            className="btn btn-outline min-h-touch mt-3 w-full"
          >
            Export JSON
          </button>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs opacity-70">
              Import replaces this logbook with the file&apos;s. It is a restore, not a merge.
            </span>
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Import JSON"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // The value is cleared so that choosing the same file twice fires `change` both times —
                // otherwise a refused file cannot be re-chosen after being edited back.
                event.target.value = '';
                if (file) void onFileChosen(file);
              }}
              className="file-input file-input-bordered min-h-touch w-full"
            />
          </label>

          {refusal !== undefined && (
            <p role="alert" className="mt-2 text-sm text-error">
              {refusalMessage(refusal)}
            </p>
          )}
        </div>
      </Section>

      <Section title="Starting over">
        <button
          type="button"
          onClick={() => {
            setConfirmingDelete(true);
          }}
          className="btn btn-outline btn-error min-h-touch w-full"
        >
          Delete my logbook
        </button>
      </Section>

      {/* Not "delete everything": the seed venues come back on the next launch and the preferences are
          untouched, so "everything" would be a claim the app then visibly contradicts. What it deletes is
          exactly what an export captures — one sentence covering both operations. */}
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete my logbook?"
        confirmLabel="Delete"
        onExportFirst={() => void onExport()}
        onConfirm={() => void onConfirmDelete()}
        body={
          <>
            <p>
              {counts === undefined
                ? 'Every session and go on this phone will be deleted.'
                : `${countsLabel(counts).replace(', on this phone only', '')} will be deleted. There is no undo.`}
            </p>
            <p>The gyms come back on the next launch, and your settings are kept.</p>
          </>
        }
      />

      <ConfirmDialog
        open={pending !== undefined}
        onOpenChange={(open) => {
          if (!open) setPending(undefined);
        }}
        title="Replace your logbook?"
        confirmLabel="Replace"
        onExportFirst={() => void onExport()}
        onConfirm={() => {
          if (pending) void onConfirmImport(pending);
        }}
        body={
          <>
            <p>
              {pending === undefined
                ? ''
                : `This file holds ${String(pending.counts.ticks)} ${pending.counts.ticks === 1 ? 'go' : 'goes'} in ${String(pending.counts.sessions)} ${pending.counts.sessions === 1 ? 'session' : 'sessions'}, exported ${new Date(pending.exported_at).toLocaleDateString()}.`}
            </p>
            {/* An empty logbook is the day-one restore — a fresh install, or the new origin after the
                Phase 1 move (§9.0). "0 ticks will be deleted. There is no undo." is both true and
                needlessly alarming on the one path where nothing is at stake. */}
            <p>
              {counts === undefined
                ? 'Everything currently on this phone will be deleted.'
                : counts.ticks === 0 && counts.sessions === 0
                  ? 'There is nothing on this phone to replace.'
                  : `${countsLabel(counts).replace(', on this phone only', '')} on this phone will be deleted. There is no undo.`}
            </p>
          </>
        }
      />
    </div>
  );
}
