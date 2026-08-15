import { useEffect, useState } from 'react';
import { db } from '../../db/schema.ts';
import { currentPersistence, type PersistState } from '../../db/persist.ts';
import { ThemeControl } from './ThemeControl.tsx';
import { HapticControl } from './HapticControl.tsx';
import { buildExport, downloadExport, exportFileName, type LogbookCounts } from './logbookFile.ts';

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

function countsLabel(counts: LogbookCounts): string {
  const ticks = `${String(counts.ticks)} ${counts.ticks === 1 ? 'tick' : 'ticks'}`;
  const sessions = `${String(counts.sessions)} ${counts.sessions === 1 ? 'session' : 'sessions'}`;
  return `${ticks} in ${sessions}, on this phone only`;
}

export function SettingsScreen({ now = new Date() }: { now?: Date }) {
  const [storage, setStorage] = useState<PersistState | undefined>();
  const [counts, setCounts] = useState<LogbookCounts | undefined>();

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
    downloadExport(await buildExport(db, now), exportFileName(now));
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
        </div>
      </Section>
    </div>
  );
}
