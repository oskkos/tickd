import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/schema.ts';
import { seedVenues } from '../../db/seed.ts';
import { sendStyleOf } from '../../db/style.ts';
import { LoggingScreen } from './LoggingScreen.tsx';

/**
 * End to end against the real seeded venues and the real database — the closest thing to logging a
 * session that does not involve a phone.
 */
beforeEach(async () => {
  await db.ticks.clear();
  await db.sessions.clear();
  await db.venues.clear();
  await seedVenues(db);
});

async function startAt(name: string | RegExp) {
  render(<LoggingScreen />);
  await userEvent.click(await screen.findByRole('button', { name }));
  await userEvent.click(screen.getByRole('button', { name: /start session/i }));
}

describe('a full session', () => {
  it('logs a flash in two taps and shows it in the list', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);

    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6c+' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    const stored = await db.ticks.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0] && sendStyleOf(stored[0])).toBe('flash');
    expect(stored[0]?.protection).toBe('lead');

    expect(await screen.findByRole('listitem')).toHaveTextContent('6c+');
  });

  it('records four goes on one climb as four rows with one first encounter', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);

    for (const cell of [
      /first go, fell/i,
      /tried it, fell/i,
      /tried it, fell/i,
      /tried it, sent/i,
    ]) {
      await userEvent.click(await screen.findByRole('button', { name: 'Grade 7a' }));
      await userEvent.click(screen.getByRole('button', { name: cell }));
    }

    const stored = await db.ticks.toArray();
    expect(stored).toHaveLength(4);
    // Exactly one first encounter, so flash rate counts the climb once and no flash is recorded.
    expect(stored.filter((t) => t.prior_experience === 'none')).toHaveLength(1);
    expect(stored.filter((t) => sendStyleOf(t) === 'flash')).toHaveLength(0);
  });

  it('lets a mis-tapped grade be abandoned without writing anything', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);

    await userEvent.click(await screen.findByRole('button', { name: 'Grade 8c' }));
    await userEvent.click(screen.getByRole('button', { name: /change grade/i }));

    // Back at the grid with nothing written — not committed-then-undone.
    expect(await screen.findByRole('button', { name: 'Grade 6a' })).toBeInTheDocument();
    expect(await db.ticks.count()).toBe(0);
  });

  it('undoes a tick logged two climbs ago', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);

    for (const grade of ['6a', '6b', '6c']) {
      await userEvent.click(await screen.findByRole('button', { name: `Grade ${grade}` }));
      await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));
    }

    await userEvent.click(await screen.findByRole('button', { name: 'Undo 6a' }));

    const remaining = await db.ticks.toArray();
    expect(remaining.map((t) => t.grade_raw).sort()).toEqual(['6b', '6c']);
  });

  it('annotates the tick just logged without logging it again', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6a' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    await userEvent.click(await screen.findByRole('button', { name: 'overhang' }));

    const stored = await db.ticks.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.angle).toBe('overhang');
  });

  it('switches notation with the discipline', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);

    await userEvent.click(await screen.findByRole('button', { name: 'Boulder' }));

    // Salmisaari grades boulders in Font and rope in French — a different grid, not a relabelled one.
    expect(await screen.findByRole('button', { name: 'Grade 6A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grade 9c' })).toBeNull();
  });

  it('hides protection on boulder, because none means boulder', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    expect(screen.getByRole('group', { name: 'Protection' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Boulder' }));

    expect(screen.queryByRole('group', { name: 'Protection' })).toBeNull();
  });

  it('ends the session and returns to the venue picker', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6a' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    await userEvent.click(screen.getByRole('button', { name: /end session/i }));

    expect(await screen.findByRole('heading', { name: /where are we/i })).toBeInTheDocument();
    expect((await db.sessions.toArray())[0]?.ended_at).toBeDefined();
  });

  it('discards a session that logged nothing', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(screen.getByRole('button', { name: /end session/i }));

    expect(await db.sessions.count()).toBe(0);
  });
});

describe('a boulder-only venue', () => {
  it('offers no rope option at all', async () => {
    await startAt(/Tampereen Kiipeilykeskus Lielahti/);

    // Absent, not disabled — Lielahti carries no rope scale, so rope is not a state that exists.
    expect(await screen.findByRole('button', { name: 'Grade 6a' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rope' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Protection' })).toBeNull();
  });

  it('grades its boulders in French, not Font', async () => {
    await startAt(/Tampereen Kiipeilykeskus Lielahti/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6a' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    // A scale is a notation, not a discipline (D17). Nothing may treat Font as "the boulder scale".
    const stored = await db.ticks.toArray();
    expect(stored[0]?.grade_scale).toBe('french');
    expect(stored[0]?.discipline).toBe('boulder');
    expect(stored[0]?.protection).toBe('none');
  });
});

describe('the venue picker', () => {
  it('lists every seeded venue and needs no location', async () => {
    render(<LoggingScreen />);

    // Wait for content, not the container: the list element renders immediately and fills in once
    // the venues load.
    await screen.findByRole('button', { name: /Kiipeilyareena Salmisaari/ });

    const list = screen.getByRole('list', { name: 'Venues' });
    expect(within(list).getAllByRole('button')).toHaveLength(4);
  });
});
