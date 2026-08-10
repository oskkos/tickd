import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FontLabel, FrenchLabel } from '@tickd/grade-spec';
import { db, newId } from '../../db/schema.ts';
import { localDateOf } from '../../db/sessions.ts';
import { renderApp } from '../../testing/renderApp.tsx';
import type { PriorExperience, Session, Tick, TickDiscipline, TickGrade } from '../../db/types.ts';

/**
 * Against the real database and the real router, entered at `/sessions`.
 *
 * The screen reads the `db` singleton and navigates with `Link`, so both have to be genuine — a
 * fixture-injected list would not exercise the read, and a bare render would throw for want of router
 * context.
 */
beforeEach(async () => {
  await db.ticks.clear();
  await db.sessions.clear();
  await db.venues.clear();
});

const HOUR = 60 * 60 * 1000;
/** Fixed points relative to real time, because `dayLabel` compares against the actual local day. */
const NOW = Date.now();
const TODAY = localDateOf(new Date(NOW));

function session(over: Partial<Session> & { started_at: number }): Session {
  return {
    id: newId(),
    venue_id: 'v-salmisaari',
    date_local: TODAY,
    ...over,
  };
}

function tick(
  sessionId: string,
  climb: TickDiscipline & TickGrade,
  createdAt: number,
  is_send = true,
  prior_experience: PriorExperience = 'none',
): Tick {
  return {
    id: newId(),
    session_id: sessionId,
    is_send,
    prior_experience,
    date_local: TODAY,
    tz_offset: 180,
    created_at: createdAt,
    updated_at: createdAt,
    ...climb,
  };
}

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

async function seedVenue() {
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
}

/**
 * The card items — **direct children only**.
 *
 * `within(list).getAllByRole('listitem')` also returns every pill, because each go is an `<li>` nested
 * inside its card. That made `cards()[1]` the first card's second pill, and the ordering assertions
 * passed or failed for the wrong reason.
 */
function cards(): HTMLElement[] {
  const list = screen.getByRole('list', { name: 'Sessions' });
  return [...list.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
}

/** One card, or a failure that names what was missing rather than `undefined` two lines later. */
function card(index: number): HTMLElement {
  const found = cards()[index];
  if (!found) {
    throw new Error(`no session card at index ${String(index)}`);
  }
  return found;
}

describe('the empty state', () => {
  it('says what will appear rather than showing an empty list', async () => {
    await renderApp({ initialPath: '/sessions' });

    expect(await screen.findByText(/nothing logged yet/i)).toBeInTheDocument();
    expect(screen.getByText(/every visit you log appears here/i)).toBeInTheDocument();
  });

  it('offers a way to start one', async () => {
    await renderApp({ initialPath: '/sessions' });

    await userEvent.click(await screen.findByRole('link', { name: /start a session/i }));

    expect(await screen.findByRole('heading', { name: /where are we/i })).toBeInTheDocument();
  });
});

describe('the list', () => {
  it('shows sessions newest first', async () => {
    await seedVenue();
    const older = session({ started_at: NOW - 5 * HOUR, ended_at: NOW - 4 * HOUR });
    const newer = session({ started_at: NOW - 2 * HOUR, ended_at: NOW - HOUR });
    await db.sessions.bulkAdd([older, newer]);
    await db.ticks.bulkAdd([
      tick(older.id, rope('6a'), NOW - 5 * HOUR),
      tick(newer.id, rope('7a'), NOW - 2 * HOUR),
    ]);

    await renderApp({ initialPath: '/sessions' });

    await screen.findByRole('list', { name: 'Sessions' });
    const [first, second] = cards();
    expect(first).toHaveTextContent('7a');
    expect(second).toHaveTextContent('6a');
  });

  it('puts the open session first and says it is still running', async () => {
    await seedVenue();
    const closed = session({ started_at: NOW - 2 * HOUR, ended_at: NOW - HOUR });
    const open = session({ started_at: NOW - 30 * 60_000 });
    await db.sessions.bulkAdd([closed, open]);
    await db.ticks.bulkAdd([
      tick(closed.id, rope('6a'), NOW - 2 * HOUR),
      tick(open.id, rope('6b'), NOW - 20 * 60_000),
    ]);

    await renderApp({ initialPath: '/sessions' });
    await screen.findByRole('list', { name: 'Sessions' });

    // In words, not only by colour — this is the one card whose numbers are still moving.
    expect(cards()[0]).toHaveTextContent(/still running/i);
    expect(cards()[1]).not.toHaveTextContent(/still running/i);
  });

  it('names the venue and the protections used', async () => {
    await seedVenue();
    const s = session({ started_at: NOW - 2 * HOUR, ended_at: NOW - HOUR });
    await db.sessions.add(s);
    await db.ticks.bulkAdd([
      tick(s.id, rope('6a'), NOW - 2 * HOUR),
      tick(s.id, toprope('6b'), NOW - 90 * 60_000),
    ]);

    await renderApp({ initialPath: '/sessions' });
    await screen.findByRole('list', { name: 'Sessions' });

    expect(cards()[0]).toHaveTextContent('Kiipeilyareena Salmisaari · lead · toprope');
  });

  it('calls a boulder go boulder rather than listing "none" as a protection', async () => {
    await seedVenue();
    const s = session({ started_at: NOW - 2 * HOUR, ended_at: NOW - HOUR });
    await db.sessions.add(s);
    await db.ticks.add(tick(s.id, boulder('6A'), NOW - 2 * HOUR));

    await renderApp({ initialPath: '/sessions' });
    await screen.findByRole('list', { name: 'Sessions' });

    // §7.4 defines the absence of protection as what makes a climb a boulder, so the word for it is
    // the discipline — "none" would read as a fourth way of being roped.
    expect(cards()[0]).toHaveTextContent('boulder');
    expect(cards()[0]).not.toHaveTextContent('none');
  });

  it('tells two sessions on one day apart by their start time', async () => {
    await seedVenue();
    const morning = session({ started_at: new Date(NOW).setHours(9, 15, 0, 0) });
    const evening = session({ started_at: new Date(NOW).setHours(18, 30, 0, 0) });
    await db.sessions.bulkAdd([
      { ...morning, ended_at: new Date(NOW).setHours(10, 0, 0, 0) },
      { ...evening, ended_at: new Date(NOW).setHours(20, 0, 0, 0) },
    ]);
    await db.ticks.bulkAdd([
      tick(morning.id, boulder('6A'), morning.started_at),
      tick(evening.id, rope('6a'), evening.started_at),
    ]);

    await renderApp({ initialPath: '/sessions' });
    await screen.findByRole('list', { name: 'Sessions' });

    // Both read "Today", so without the clock they would be indistinguishable.
    expect(cards()[0]).toHaveTextContent('18:30');
    expect(cards()[1]).toHaveTextContent('09:15');
  });
});

describe('the goes on a card', () => {
  it('shows one pill per go, never a count', async () => {
    await seedVenue();
    const s = session({ started_at: NOW - 2 * HOUR, ended_at: NOW - HOUR });
    await db.sessions.add(s);
    await db.ticks.bulkAdd([
      tick(s.id, rope('6b'), NOW - 2 * HOUR, false, 'none'),
      tick(s.id, rope('6b'), NOW - 100 * 60_000, false, 'attempted'),
      tick(s.id, rope('6b'), NOW - 95 * 60_000, true, 'attempted'),
    ]);

    await renderApp({ initialPath: '/sessions' });
    const goes = await screen.findByRole('list', { name: /goes/i });

    // The mock showed `6b ×3`. Three goes at one grade — two falls and a send — is precisely what a
    // tally destroys, and it is the distinction the outcome model exists to record.
    expect(within(goes).getAllByRole('listitem')).toHaveLength(3);
    expect(cards()[0]).not.toHaveTextContent('×3');
    expect(within(goes).getAllByLabelText('6b, not sent')).toHaveLength(2);
    expect(within(goes).getByLabelText('6b, sent')).toBeInTheDocument();
  });

  it('splits French rope from Font boulder and labels both', async () => {
    await seedVenue();
    const s = session({ started_at: NOW - 2 * HOUR, ended_at: NOW - HOUR });
    await db.sessions.add(s);
    await db.ticks.bulkAdd([
      tick(s.id, rope('6a'), NOW - 2 * HOUR),
      tick(s.id, boulder('6A'), NOW - 100 * 60_000),
    ]);

    await renderApp({ initialPath: '/sessions' });
    await screen.findByRole('list', { name: 'Sessions' });

    // Ungrouped, `6a` and `6A` sit adjacent differing only by letter case — one scale with a typo in it
    // rather than two ordinal namespaces.
    expect(screen.getByRole('list', { name: 'Goes, rope · French' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Goes, boulder · Font' })).toBeInTheDocument();
    expect(screen.getByText('rope · French')).toBeInTheDocument();
    expect(screen.getByText('boulder · Font')).toBeInTheDocument();
  });

  it('shows no group heading when a session is all one discipline and scale', async () => {
    await seedVenue();
    const s = session({ started_at: NOW - 2 * HOUR, ended_at: NOW - HOUR });
    await db.sessions.add(s);
    await db.ticks.bulkAdd([
      tick(s.id, rope('6a'), NOW - 2 * HOUR),
      tick(s.id, rope('6b'), NOW - 100 * 60_000),
    ]);

    await renderApp({ initialPath: '/sessions' });
    await screen.findByRole('list', { name: 'Sessions' });

    // A heading that never varies is noise.
    expect(screen.queryByText('rope · French')).toBeNull();
  });
});

describe('what the list refuses to show', () => {
  it('shows no vertical distance anywhere', async () => {
    await seedVenue();
    const s = session({ started_at: NOW - 2 * HOUR, ended_at: NOW - HOUR });
    await db.sessions.add(s);
    await db.ticks.add(tick(s.id, rope('6a'), NOW - 2 * HOUR));

    await renderApp({ initialPath: '/sessions' });
    await screen.findByRole('list', { name: 'Sessions' });

    // The mock's header read `3.9 km up`. Wall heights are seeded absent so it cannot be computed,
    // volume metrics are Phase 1, and Phase 0 ships exactly one analytic on its own screen.
    expect(screen.getByRole('main').textContent).not.toMatch(/\bkm\b|\bmetres\b|\bm up\b/i);
  });

  it('offers nothing that deletes a session', async () => {
    await seedVenue();
    const s = session({ started_at: NOW - 2 * HOUR, ended_at: NOW - HOUR });
    await db.sessions.add(s);
    await db.ticks.add(tick(s.id, rope('6a'), NOW - 2 * HOUR));

    await renderApp({ initialPath: '/sessions' });
    await screen.findByRole('list', { name: 'Sessions' });

    // Undo stays session-scoped: it exists because a two-tap interface maximises mis-taps at the wall,
    // which is a different operation from editing history.
    expect(screen.queryByRole('button', { name: /delete|remove|undo/i })).toBeNull();
  });
});

describe('opening a session', () => {
  it('opens a closed session detail', async () => {
    await seedVenue();
    const s = session({ started_at: NOW - 2 * HOUR, ended_at: NOW - HOUR });
    await db.sessions.add(s);
    await db.ticks.add(tick(s.id, rope('6a'), NOW - 2 * HOUR));

    await renderApp({ initialPath: '/sessions' });
    await screen.findByRole('list', { name: 'Sessions' });
    await userEvent.click(within(card(0)).getByRole('link'));

    expect(await screen.findByTestId('session-id')).toHaveTextContent(s.id);
  });

  it('sends the open session back to logging instead', async () => {
    await seedVenue();
    const open = session({ started_at: NOW - 30 * 60_000 });
    await db.sessions.add(open);
    await db.ticks.add(tick(open.id, rope('6a'), NOW - 20 * 60_000));

    await renderApp({ initialPath: '/sessions' });
    await screen.findByRole('list', { name: 'Sessions' });
    await userEvent.click(within(card(0)).getByRole('link'));

    // What you want from the session you are standing in is to carry on logging it, and that screen
    // already lists its goes with undo attached.
    expect(await screen.findByRole('button', { name: /end session/i })).toBeInTheDocument();
  });
});
