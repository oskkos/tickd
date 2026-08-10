import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FontLabel, FrenchLabel } from '@tickd/grade-spec';
import { db, newId } from '../../db/schema.ts';
import { localDateOf } from '../../db/sessions.ts';
import { renderApp } from '../../testing/renderApp.tsx';
import type {
  GradeOpinion,
  HoldType,
  PriorExperience,
  Rating,
  Session,
  Tick,
  TickDiscipline,
  TickGrade,
  WallAngle,
} from '../../db/types.ts';

beforeEach(async () => {
  await db.ticks.clear();
  await db.sessions.clear();
  await db.venues.clear();
});

const HOUR = 60 * 60 * 1000;
const NOW = Date.now();
const TODAY = localDateOf(new Date(NOW));
const SESSION_ID = 'session-under-test';

const rope = (grade_raw: FrenchLabel): TickDiscipline & TickGrade => ({
  discipline: 'sport',
  protection: 'lead',
  grade_scale: 'french',
  grade_raw,
});

const toprope = (grade_raw: FrenchLabel): TickDiscipline & TickGrade => ({
  discipline: 'sport',
  protection: 'toprope',
  grade_scale: 'french',
  grade_raw,
});

const boulder = (grade_raw: FontLabel): TickDiscipline & TickGrade => ({
  discipline: 'boulder',
  protection: 'none',
  grade_scale: 'font',
  grade_raw,
});

/**
 * The fields a test may override, spelled out rather than `Partial<Tick>`.
 *
 * Under `exactOptionalPropertyTypes` a `Partial<T>` optional is `T | undefined`, which cannot be spread
 * into a target whose optional is plain `T` — so `Partial<Tick>` does not in fact produce a `Tick`.
 * Listing them also keeps the factory from setting a field no test meant to set.
 */
interface Overrides {
  is_send?: boolean;
  prior_experience?: PriorExperience;
  angle?: WallAngle;
  holds?: readonly HoldType[];
  rating?: Rating;
  grade_opinion?: GradeOpinion;
  length_m?: number;
  notes?: string;
}

function tick(climb: TickDiscipline & TickGrade, createdAt: number, over: Overrides = {}): Tick {
  return {
    id: newId(),
    session_id: SESSION_ID,
    is_send: true,
    prior_experience: 'none' satisfies PriorExperience,
    date_local: TODAY,
    tz_offset: 180,
    created_at: createdAt,
    updated_at: createdAt,
    ...climb,
    ...over,
  };
}

const SESSION: Session = {
  id: SESSION_ID,
  venue_id: 'v-salmisaari',
  date_local: TODAY,
  started_at: NOW - 2 * HOUR,
  ended_at: NOW - HOUR,
};

async function seed(ticks: readonly Tick[], session: Session = SESSION) {
  await db.venues.add({
    id: 'v-salmisaari',
    type: 'indoor',
    name: 'Kiipeilyareena Salmisaari',
    city: 'Helsinki',
    country: 'FI',
    pending_review: false,
    default_scale_rope: 'french',
    default_scale_boulder: 'font',
  });
  await db.sessions.add(session);
  await db.ticks.bulkAdd([...ticks]);
}

function open() {
  return renderApp({ initialPath: `/sessions/${SESSION_ID}` });
}

/** The go rows — direct children, since each row's contents include no nested list items. */
function rows() {
  return within(screen.getByRole('list', { name: 'Goes' })).getAllByRole('listitem');
}

describe('the header', () => {
  it('names the venue, the day, the span and what was logged', async () => {
    await seed([
      tick(rope('6a'), NOW - 2 * HOUR),
      tick(rope('6b'), NOW - 100 * 60_000, { is_send: false, prior_experience: 'none' }),
      tick(rope('6c'), NOW - 95 * 60_000, { prior_experience: 'attempted' }),
    ]);
    await open();

    expect(
      await screen.findByRole('heading', { name: 'Kiipeilyareena Salmisaari' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 h 0 min/)).toBeInTheDocument();
    // Two sends, one of which had been tried before, so exactly one flash.
    expect(screen.getByText(/3 ticks · 2 sent · 1 flashed/)).toBeInTheDocument();
  });

  it('says so plainly when the session is not there', async () => {
    // The id comes from the URL: a stale bookmark, or a database wiped by a schema change.
    await renderApp({ initialPath: '/sessions/no-such-session' });

    expect(await screen.findByRole('heading', { name: /session not found/i })).toBeInTheDocument();
  });
});

describe('the goes', () => {
  it('lists them oldest first', async () => {
    await seed([
      tick(rope('6c'), NOW - 95 * 60_000),
      tick(rope('6a'), NOW - 2 * HOUR),
      tick(rope('6b'), NOW - 100 * 60_000),
    ]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    // The story of the session. The recent-ticks list is newest-first because its job is undo.
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining('6a'),
      expect.stringContaining('6b'),
      expect.stringContaining('6c'),
    ]);
  });

  it('keeps a mixed session interleaved rather than sectioning it', async () => {
    await seed([
      tick(rope('6a'), NOW - 2 * HOUR),
      tick(boulder('6A'), NOW - 100 * 60_000),
      tick(rope('6b'), NOW - 95 * 60_000),
    ]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    // Grouping would hide that the climber went to the boulder wall between two routes, which is the
    // sort of thing a session log exists to record.
    expect(rows().map((r) => r.textContent)).toEqual([
      expect.stringContaining('6a'),
      expect.stringContaining('6A'),
      expect.stringContaining('6b'),
    ]);
  });

  it('names the protection and the prior experience on every row', async () => {
    await seed([tick(toprope('6a'), NOW - 2 * HOUR, { prior_experience: 'sent' })]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    // The same vocabulary the recent-ticks list uses, not the stored enum values.
    expect(rows()[0]).toHaveTextContent('toprope · done before');
  });

  it('calls a boulder go boulder and shows no protection for it', async () => {
    await seed([tick(boulder('6B'), NOW - 2 * HOUR)]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    // `protection: 'none'` *means* boulder (§7.4). Printing the stored value put the word "none" in
    // front of the climber, offering "no protection" as a fourth way of being roped.
    expect(rows()[0]).toHaveTextContent('boulder · first go');
    expect(rows()[0]).not.toHaveTextContent('none');
  });

  it('announces how a go ended, since the mark is a glyph', async () => {
    await seed([
      tick(rope('6a'), NOW - 2 * HOUR),
      tick(rope('6b'), NOW - 100 * 60_000, { is_send: false }),
      tick(rope('6c'), NOW - 95 * 60_000, { prior_experience: 'attempted' }),
    ]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    expect(rows()[0]).toHaveTextContent('flashed');
    expect(rows()[1]).toHaveTextContent('not sent');
    expect(rows()[2]).toHaveTextContent('sent');
  });

  it('renders a bare go on one line', async () => {
    await seed([tick(rope('6a'), NOW - 2 * HOUR)]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    // Most goes carry nothing, so a row that reserved space for every optional field would make a
    // fourteen-tick session fifty lines long.
    expect(rows()[0]?.textContent).not.toMatch(/felt|\/5|\bm\b|"|overhang|crimp/);
  });

  it('shows every stored annotation when a go has them all', async () => {
    await seed([
      tick(rope('7a'), NOW - 2 * HOUR, {
        angle: 'overhang',
        holds: ['crimp', 'sloper'],
        rating: 4,
        grade_opinion: 'hard',
        length_m: 12,
        notes: 'long reach off the undercling',
      }),
    ]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    const row = rows()[0];
    expect(row).toHaveTextContent('overhang · crimp, sloper');
    expect(row).toHaveTextContent('4/5 · felt hard · 12 m');
    expect(row).toHaveTextContent('long reach off the undercling');
  });

  it('renders the grade verbatim so Font and French stay apart', async () => {
    await seed([tick(boulder('6A'), NOW - 2 * HOUR)]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    expect(screen.getByText('6A')).toBeInTheDocument();
  });
});

describe('correcting a go', () => {
  it('reopens the sheet seeded with what the go carries, without claiming it was just logged', async () => {
    await seed([tick(rope('6a'), NOW - 2 * HOUR, { angle: 'overhang', notes: 'sloper crux' })]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    await userEvent.click(screen.getByRole('button', { name: 'Detail for 6a' }));

    const sheet = screen.getByRole('region', { name: 'Detail for 6a' });
    expect(within(sheet).getByRole('button', { name: 'overhang' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Deliberate, so no countdown and no "Logged" — the go is weeks old by the time this screen is read.
    expect(sheet).not.toHaveTextContent(/logged/i);
    expect(screen.queryByTestId('sheet-countdown')).toBeNull();
  });

  it('persists an edit to a go in a closed session', async () => {
    const target = tick(rope('6a'), NOW - 2 * HOUR);
    await seed([target]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    await userEvent.click(screen.getByRole('button', { name: 'Detail for 6a' }));
    await userEvent.click(screen.getByRole('button', { name: 'roof' }));

    // Annotation was never gated on the session being open, and should not be — the whole point of
    // this screen is that history stops being write-only.
    const stored = await db.ticks.get(target.id);
    expect(stored?.angle).toBe('roof');
  });

  it('shows the edit on the row without a reload', async () => {
    await seed([tick(rope('6a'), NOW - 2 * HOUR)]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    await userEvent.click(screen.getByRole('button', { name: 'Detail for 6a' }));
    await userEvent.click(screen.getByRole('button', { name: 'roof' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByText(/roof/)).toBeInTheDocument();
  });
});

describe('what the detail refuses to offer', () => {
  it('has no way to delete a go or the session', async () => {
    await seed([tick(rope('6a'), NOW - 2 * HOUR)]);
    await open();
    await screen.findByRole('list', { name: 'Goes' });

    // Undo stays session-scoped: it exists for mis-taps at the wall, which is a different operation
    // from editing history.
    expect(screen.queryByRole('button', { name: /undo|delete|remove/i })).toBeNull();
  });
});
