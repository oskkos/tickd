import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { GoSheet } from '../../components/go/GoSheet.tsx';
import { OutcomeIcon } from '../../components/OutcomeIcon.tsx';
import { useGoSheet } from '../../components/go/useGoSheet.ts';
import { db } from '../../db/schema.ts';
import { sessionDetail, type SessionDetail } from '../../db/sessions.ts';
import { isFlash, outcomeOf } from '../../db/style.ts';
import { clockTime, dayLabel, formatDuration } from '../../format/time.ts';
import { outcomeWord, priorLabel, protectionLabel } from '../../format/climbing.ts';
import type { Tick } from '../../db/types.ts';

/**
 * One session, every go, everything each go carries.
 *
 * **This screen is the reason the change exists.** `GoSheet` collects six optional fields and
 * until now the only read path was the open session's recent-ticks list — so notes, rating, grade
 * opinion, angle, holds and length became unreachable the moment the session closed, recoverable only
 * by exporting JSON and reading it by hand.
 *
 * **Chronological, not grouped by discipline.** The list is the sequence of the visit: grouping would
 * hide that the climber moved to the boulder wall after failing a route, which is the sort of thing a
 * session log is for. The cards group because they are a glance surface where two notations sit
 * adjacent; a row has its protection beside it, so `6a+ toprope` and `6A boulder` cannot be confused
 * and no scale label is needed.
 *
 * **Oldest first**, like the session summary and unlike the recent-ticks list — that list is
 * newest-first because its job is undo, which is a different question from "how did the evening go".
 */

/** A go's line one, which every row has, plus whatever else it carries. */
function GoRow({ tick, onOpen }: { tick: Tick; onOpen: (tick: Tick) => void }) {
  const outcome = outcomeOf(tick);
  const holds = tick.holds ?? [];
  // Each of the three optional lines is present only when it has something on it. Most goes carry
  // nothing, so a row that always reserved space for all four would make a fourteen-tick session
  // fifty lines long.
  const characteristics = [tick.angle, holds.length > 0 ? holds.join(', ') : undefined].filter(
    Boolean,
  );
  const opinions = [
    tick.rating === undefined ? undefined : `${String(tick.rating)}/5`,
    tick.grade_opinion === undefined ? undefined : `felt ${tick.grade_opinion}`,
    tick.length_m === undefined ? undefined : `${String(tick.length_m)} m`,
  ].filter(Boolean);

  return (
    <li>
      {/* Tapping a go reopens its sheet, which is what makes the annotation fields correctable rather
          than only readable — notes, rating, grade felt, angle, holds, length.

          **It does not reach `prior_experience` or `is_send`, and this comment used to imply it did.**
          The write path is `annotateTick`, deliberately confined to fields outside `TickOutcome` because
          a partial of a discriminated union is unsound. So a mis-tapped `prior_experience` is still
          permanently wrong — which matters, because it is flash rate's denominator — and correcting it
          needs a write that replaces the whole outcome plus a control to drive it. Neither is here. */}
      <button
        type="button"
        onClick={() => {
          onOpen(tick);
        }}
        aria-label={`Detail for ${tick.grade_raw}`}
        className="min-h-touch rounded-box flex w-full gap-3 bg-base-200 px-3 py-2 text-left text-sm"
      >
        {/* In the zone the go was logged in, not the one it is being read in. */}
        <span className="tabular shrink-0 opacity-60">
          {clockTime(tick.created_at, tick.tz_offset)}
        </span>
        {/* Verbatim — case is all that separates Font `6A` from French `6a`. */}
        <span className="tabular w-14 shrink-0 text-base">{tick.grade_raw}</span>
        {/* The same mark the pills use. These rows drew their own text glyphs (`⚡ ↑ ↓`) at first, which
            made a send a thumb on the session list and an arrow one tap later — the same three outcomes
            in two vocabularies. The icon is `aria-hidden`, so the word comes with it. */}
        <span className="shrink-0">
          <OutcomeIcon outcome={outcome} />
          <span className="sr-only">{outcomeWord(outcome)}</span>
        </span>

        <span className="flex-1">
          <span className="block">
            {/* `protection: 'none'` prints as `boulder`, because that is what it means (§7.4). */}
            {protectionLabel(tick)} · {priorLabel(tick.prior_experience)}
          </span>
          {characteristics.length > 0 && (
            <span className="block opacity-60">{characteristics.join(' · ')}</span>
          )}
          {opinions.length > 0 && <span className="block opacity-60">{opinions.join(' · ')}</span>}
          {tick.notes !== undefined && tick.notes !== '' && (
            <span className="mt-0.5 block italic opacity-70">&ldquo;{tick.notes}&rdquo;</span>
          )}
        </span>
      </button>
    </li>
  );
}

export function SessionDetailScreen() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId' });
  const [detail, setDetail] = useState<SessionDetail | undefined | 'missing' | 'unreadable'>();

  const read = useCallback(() => sessionDetail(db, sessionId), [sessionId]);

  /** `'missing'` rather than `undefined`, which already means "not read yet". The id comes from the
   *  URL, so a stale bookmark or a wiped database is ordinary and has to be said out loud. */
  const apply = useCallback((found: SessionDetail | undefined) => {
    setDetail(found ?? 'missing');
  }, []);

  useEffect(() => {
    void read().then(apply, (error: unknown) => {
      // Left unhandled this was an unhandled rejection and a permanently blank screen. And
      // **`'unreadable'`, not `'missing'`** — a read that failed is not a row that is absent. Collapsing
      // the two told the climber their session had been deleted when IndexedDB was merely blocked by
      // another tab, which is precisely the "reads as data loss" failure `StorageWarning` exists for.
      console.error('[tickd] could not read the session', error);
      setDetail('unreadable');
    });
  }, [read, apply]);

  const refresh = useCallback(() => {
    void read().then(apply, (error: unknown) => {
      console.error('[tickd] could not re-read the session', error);
    });
  }, [read, apply]);

  /**
   * **Nothing per keystroke.** The write still happens on every change — that is what makes the sheet
   * safe to close at any moment — but the screen behind it does not re-read.
   *
   * It used to. `AnnotationPanel`'s notes field fires `onChange` per character, and each one ran
   * `sessionDetail`: three queries plus a re-render of every go. A forty-character note on a thirty-go
   * session meant forty writes, a hundred and twenty reads and forty full re-renders — felt as keystroke
   * lag on a phone. Nothing was gained by it either: the backdrop covers the row being edited, so the
   * staleness is invisible until the sheet closes, and that is exactly when the re-read now happens.
   *
   * Re-reading rather than merging the annotation into the row locally, deliberately: the database stays
   * the only authority on what a tick says, and a local merge would be a second one.
   */
  const sheet = useGoSheet(
    useCallback(() => {
      /* the row is behind the sheet; it is re-read when the sheet closes */
    }, []),
  );

  if (detail === undefined) {
    return <div className="flex min-h-0 flex-1 flex-col gap-4" />;
  }

  if (detail === 'unreadable') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <h2 className="text-2xl">Couldn&rsquo;t read this session</h2>
        {/* Says what is true — the read failed — and never that the data is gone. Another tab holding
            the database open is the common cause and it is fixable by the person reading this. */}
        <p role="alert" className="text-sm opacity-70">
          Something stopped tickd reading your logbook just now. Another tab may have it open. Your
          session has not been deleted &mdash; try again.
        </p>
        <Link to="/sessions" className="btn btn-primary min-h-touch-lg mt-auto w-full text-base">
          Back to sessions
        </Link>
      </div>
    );
  }

  if (detail === 'missing') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <h2 className="text-2xl">Session not found</h2>
        <p className="text-sm opacity-70">
          This session is no longer in your logbook. It may have been on a device whose data was
          cleared.
        </p>
        <Link to="/sessions" className="btn btn-primary min-h-touch-lg mt-auto w-full text-base">
          Back to sessions
        </Link>
      </div>
    );
  }

  const { session, venue, ticks } = detail;
  const sends = ticks.filter((t) => t.is_send).length;
  const flashes = ticks.filter(isFlash).length;
  const zone = ticks[0]?.tz_offset;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0">
        <h2 className="text-2xl">{venue?.name ?? 'Session'}</h2>
        <p className="text-sm opacity-70">
          {/* `Session` stores no offset (§7.7), so the span borrows one from the session's first go —
              the only place the zone this was climbed in is recorded. A session with no ticks has none
              to borrow and falls back to the reader's own zone. */}
          {dayLabel(session.date_local, new Date())} · {clockTime(session.started_at, zone)}
          {session.ended_at !== undefined && ` – ${clockTime(session.ended_at, zone)}`}
          {session.ended_at !== undefined &&
            ` · ${formatDuration(session.ended_at - session.started_at)}`}
        </p>
        <p className="text-sm opacity-70">
          {ticks.length} {ticks.length === 1 ? 'tick' : 'ticks'} · {sends} sent · {flashes} flashed
        </p>
      </div>

      {/* Interleaved and oldest first: the sequence is the point. */}
      <ul aria-label="Goes" className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {ticks.map((tick) => (
          <GoRow key={tick.id} tick={tick} onOpen={sheet.openForExisting} />
        ))}
      </ul>

      {/* No delete control anywhere on this screen. Undo stays session-scoped — it exists because a
          two-tap interface maximises mis-taps at the wall, which is a different operation from
          editing history, and Phase 0 accepts that a session logged at the wrong venue stays. */}

      {sheet.open && (
        <GoSheet
          // Tick and reason both, so a reopen cannot inherit a countdown from a previous mount.
          key={`${sheet.open.tick.id}:${sheet.open.reason}`}
          tick={sheet.open.tick}
          reason={sheet.open.reason}
          annotation={sheet.annotation}
          onChange={(next) => void sheet.change(next)}
          onDismiss={() => {
            sheet.dismiss();
            refresh();
          }}
        />
      )}
    </div>
  );
}
