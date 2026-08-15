import { describe, expect, it, beforeEach, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../db/schema.ts';
import { localDateOf } from '../../db/sessions.ts';
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

describe('the haptic on a written go', () => {
  it('buzzes once when the preference is on, and writes the go either way', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(globalThis.navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
      writable: true,
    });
    try {
      await startAt(/Kiipeilyareena Salmisaari/);
      await userEvent.click(await screen.findByRole('button', { name: 'Grade 6c+' }));
      await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

      expect(vibrate).toHaveBeenCalledTimes(1);
      expect(await db.ticks.count()).toBe(1);
    } finally {
      Reflect.deleteProperty(globalThis.navigator, 'vibrate');
    }
  });

  it('writes the go where the device cannot vibrate at all', async () => {
    // The signal is a bonus (`DESIGN.md` §4). Nothing about writing a tick may depend on it.
    expect(Reflect.get(globalThis.navigator, 'vibrate')).toBeUndefined();

    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6c+' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    expect(await db.ticks.count()).toBe(1);
  });
});

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

    // The list collapses to the go just logged, so an older one is behind the count. Still a tap, and
    // still never impossible — undo has to outlive the climb after it.
    await userEvent.click(await screen.findByRole('button', { name: /3 goes · show all/i }));
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

  it('stands the discipline toggle down while a grade is pending', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);

    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6a' }));

    // Salmisaari grades rope in French and boulder in Font. Tapping Boulder here used to commit the
    // pending French `6a` under `grade_scale: 'font'` — a grade Font does not have, unrepairable in
    // a phase with no migrations, and enough to make every later read of that discipline throw.
    expect(screen.queryByRole('group', { name: 'Discipline' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /change grade/i }));

    // Back once the transaction is over, not gone for the session.
    expect(screen.getByRole('group', { name: 'Discipline' })).toBeInTheDocument();
  });

  it('commits a grade against the scale it was picked on', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);

    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6a' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    const [stored] = await db.ticks.toArray();
    expect(stored?.grade_raw).toBe('6a');
    expect(stored?.grade_scale).toBe('french');
  });

  it('hides protection on boulder, because none means boulder', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    expect(screen.getByRole('group', { name: 'Protection' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Boulder' }));

    expect(screen.queryByRole('group', { name: 'Protection' })).toBeNull();
  });

  it('shows a summary before ending, and ends on confirmation', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6a' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    await userEvent.click(screen.getByRole('button', { name: /end session/i }));

    // The summary is the confirmation. Nothing has closed yet.
    expect(await screen.findByRole('list', { name: 'Grades climbed' })).toBeInTheDocument();
    expect((await db.sessions.toArray())[0]?.ended_at).toBeUndefined();

    await userEvent.click(screen.getByRole('button', { name: /^end session$/i }));

    expect(await screen.findByRole('heading', { name: /where are we/i })).toBeInTheDocument();
    expect((await db.sessions.toArray())[0]?.ended_at).toBeDefined();
  });

  it('returns to logging when the summary is backed out of', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6a' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    await userEvent.click(screen.getByRole('button', { name: /end session/i }));
    await userEvent.click(await screen.findByRole('button', { name: /keep climbing/i }));

    // Still open, still logging — the guard did its job.
    expect(await screen.findByRole('button', { name: 'Grade 6b' })).toBeInTheDocument();
    expect((await db.sessions.toArray())[0]?.ended_at).toBeUndefined();
  });

  it('discards a session that logged nothing', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(screen.getByRole('button', { name: /end session/i }));
    await userEvent.click(await screen.findByRole('button', { name: /discard session/i }));

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

  it('preselects the venue of the last session', async () => {
    await startAt(/Tampereen Kiipeilykeskus Lielahti/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6a' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));
    await userEvent.click(screen.getByRole('button', { name: /end session/i }));
    await userEvent.click(screen.getByRole('button', { name: /^end session$/i }));
    cleanup();

    render(<LoggingScreen />);
    const lielahti = await screen.findByRole('button', {
      name: /Tampereen Kiipeilykeskus Lielahti/,
    });

    // Seeded only from a currently *open* session, this left the normal path — launched after
    // ending the last session — with nothing selected, Start disabled, and the picker's own "the
    // one that's selected" pointing at nothing.
    expect(lielahti).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /start session/i })).toBeEnabled();
  });
});

describe('reopening a go from the recent list', () => {
  it('does not pretend the tick was just logged, and starts no clock', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6c+' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    // The sheet that follows the write says "Logged" and counts down, which is correct: it is an
    // interruption of the two-tap path that nobody asked for.
    expect(screen.getByRole('region', { name: 'Detail for 6c+' })).toHaveTextContent(/logged/i);
    expect(screen.getByTestId('sheet-countdown')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    await userEvent.click(screen.getByRole('button', { name: /detail for 6c\+/i }));

    // Reopening is deliberate, so neither applies. Both were wrong here before `reason` existed —
    // tapping a go announced "Logged" and gave you five seconds to fill in the form.
    const sheet = screen.getByRole('region', { name: 'Detail for 6c+' });
    expect(sheet).not.toHaveTextContent(/logged/i);
    expect(screen.queryByTestId('sheet-countdown')).toBeNull();
  });

  it('seeds the sheet from what the tick already carries', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6c+' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));
    await userEvent.click(screen.getByRole('button', { name: 'overhang' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await userEvent.click(screen.getByRole('button', { name: /detail for 6c\+/i }));

    // An empty form would overwrite the stored value on the first keystroke.
    expect(screen.getByRole('button', { name: 'overhang' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('the sticky discipline across a remount', () => {
  it('is read back from the session rather than reset to sport', async () => {
    await startAt(/Tampereen Kiipeilykeskus Nekala/);
    await userEvent.click(await screen.findByRole('button', { name: 'Boulder' }));
    // French labels, not Font: Nekala grades *both* disciplines in French (D17). That is precisely why
    // this bug was invisible — the grid looks identical whichever discipline is selected.
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6a' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    // A tab navigation unmounts this screen; so does a reload. Both used to reset the toggle to Rope,
    // and at Nekala — which grades both disciplines in French — the grid renders identical labels either
    // way, so the next go was silently written as a lead route.
    cleanup();
    render(<LoggingScreen />);

    expect(await screen.findByRole('button', { name: 'Boulder' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6b' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    const stored = await db.ticks.toArray();
    const latest = stored.find((t) => t.grade_raw === '6b');
    expect(latest?.discipline).toBe('boulder');
    expect(latest?.protection).toBe('none');
  });

  it('keeps the roped protection that was in force', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'toprope' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6a' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    cleanup();
    render(<LoggingScreen />);
    await screen.findByRole('button', { name: 'Grade 6a' });

    // `protection` is sticky *and visible*, which is the condition DESIGN.md attaches to allowing it —
    // so coming back to a screen that silently says `lead` breaks the deal.
    expect(screen.getByRole('button', { name: 'toprope' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('correcting a go mid-session', () => {
  it('re-grades a go from the recent list, and the row follows', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6c+' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    // The sheet is already open from the write, so a mis-tap is correctable without even reopening it.
    await userEvent.click(screen.getByRole('button', { name: 'Grade, 6c+' }));
    // Scoped to the sheet: the logging screen's own grid is still mounted behind the backdrop, so
    // `Grade 6c` matches twice. The backdrop covers it, but it is not removed from the accessibility
    // tree — the sheet traps no focus, which this file's other tests rely on to reach it by keyboard.
    const sheet = screen.getByRole('region', { name: 'Detail for 6c+' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Grade 6c' }));

    const stored = await db.ticks.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.grade_raw).toBe('6c');
    // The list behind the sheet refreshes through the hook's `afterWrite`, as it does for a write.
    expect(await screen.findByRole('listitem')).toHaveTextContent('6c');
  });

  it('corrects a stale sticky protection on a go already logged', async () => {
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6c+' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    // Reached from the row rather than the fresh sheet — the case where the mistake is noticed a climb
    // or two later, which is when undoing from the middle stops being acceptable.
    await userEvent.click(screen.getByRole('button', { name: /detail for 6c\+/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Protection, lead' }));
    // Scoped for the same reason: the screen's own sticky protection control is behind the backdrop.
    const sheet = screen.getByRole('region', { name: 'Detail for 6c+' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'toprope' }));

    const stored = await db.ticks.toArray();
    expect(stored[0]?.protection).toBe('toprope');
    expect(stored[0]?.discipline).toBe('sport');
    expect(await screen.findByRole('listitem')).toHaveTextContent('toprope');
  });

  it('does not move the grade grid when a go is corrected past the working range', async () => {
    // A range only exists once there is history, and `beforeEach` clears it — so seed a go from earlier
    // in the window. Without this the grid has no range at all, nothing is dimmed either way, and the
    // assertion below would pass against a grid that had repositioned.
    await db.ticks.add({
      id: 'earlier',
      session_id: 'some-earlier-session',
      discipline: 'sport',
      protection: 'lead',
      grade_scale: 'french',
      grade_raw: '6b',
      is_send: true,
      prior_experience: 'none',
      date_local: localDateOf(new Date()),
      tz_offset: 180,
      created_at: Date.now() - 24 * 60 * 60 * 1000,
      updated_at: Date.now() - 24 * 60 * 60 * 1000,
    });
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6c+' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    const dimmedBefore = within(screen.getByTestId('grade-grid'))
      .getAllByRole('button')
      .filter((b) => b.dataset.inRange === 'false')
      .map((b) => b.textContent);
    expect(dimmedBefore).toContain('9a');

    await userEvent.click(screen.getByRole('button', { name: 'Grade, 6c+' }));
    const sheet = screen.getByRole('region', { name: 'Detail for 6c+' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Grade 9a' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    // The working range is recomputed on mount and on a discipline change, never after a write — and a
    // correction is no different. Repositioning would move the grid under a thumb about to tap it.
    const dimmedAfter = within(screen.getByTestId('grade-grid'))
      .getAllByRole('button')
      .filter((b) => b.dataset.inRange === 'false')
      .map((b) => b.textContent);
    expect(dimmedAfter).toEqual(dimmedBefore);
  });

  it('keeps a boulder’s sheet free of any protection control', async () => {
    // Salmisaari grades boulders in Font and routes in French, so this is the venue where a
    // cross-discipline correction would leave the grade in the wrong notation.
    await startAt(/Kiipeilyareena Salmisaari/);
    await userEvent.click(await screen.findByRole('button', { name: 'Boulder' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Grade 6A' }));
    await userEvent.click(screen.getByRole('button', { name: /first go, flash/i }));

    const sheet = screen.getByRole('region', { name: 'Detail for 6A' });
    expect(within(sheet).queryByRole('button', { name: /^Protection,/ })).toBeNull();
    expect(within(sheet).getByRole('group', { name: 'Recorded as' })).toHaveTextContent('boulder');
  });
});
