import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FontLabel, FrenchLabel } from '@tickd/grade-spec';
import { db, newId } from '../../db/schema.ts';
import type { PriorExperience, Tick, TickDiscipline, TickGrade } from '../../db/types.ts';
import { FlashScreen } from './FlashScreen.tsx';

/**
 * Against the real database, and rendered directly rather than through `renderApp()`.
 *
 * The screen reads the `db` singleton — the router constructs it, so there is no prop to inject a
 * different one through — so the read has to be genuine. It is rendered on its own because it holds no
 * `Link` and therefore needs no router context, which keeps this suite's failures about the screen rather
 * than about the frame around it.
 *
 * `/flash` **does** exist: it was registered in the group after this suite was written, and the original
 * reason given here — that the route did not exist yet — is no longer the reason. `router.test.tsx` owns
 * the route, asserting it is reachable from the tab bar and renders when its URL is loaded directly.
 */
beforeEach(async () => {
  await db.ticks.clear();
});

const climb = {
  lead: (grade_raw: FrenchLabel): TickDiscipline & TickGrade => ({
    discipline: 'sport',
    protection: 'lead',
    grade_scale: 'french',
    grade_raw,
  }),
  toprope: (grade_raw: FrenchLabel): TickDiscipline & TickGrade => ({
    discipline: 'sport',
    protection: 'toprope',
    grade_scale: 'french',
    grade_raw,
  }),
  autobelay: (grade_raw: FrenchLabel): TickDiscipline & TickGrade => ({
    discipline: 'sport',
    protection: 'autobelay',
    grade_scale: 'french',
    grade_raw,
  }),
  boulderFont: (grade_raw: FontLabel): TickDiscipline & TickGrade => ({
    discipline: 'boulder',
    protection: 'none',
    grade_scale: 'font',
    grade_raw,
  }),
  boulderFrench: (grade_raw: FrenchLabel): TickDiscipline & TickGrade => ({
    discipline: 'boulder',
    protection: 'none',
    grade_scale: 'french',
    grade_raw,
  }),
};

function tick(
  where: TickDiscipline & TickGrade,
  is_send = true,
  prior_experience: PriorExperience = 'none',
): Tick {
  return {
    id: newId(),
    session_id: 's-1',
    is_send,
    prior_experience,
    date_local: '2026-08-01',
    tz_offset: 180,
    created_at: 0,
    updated_at: 0,
    ...where,
  };
}

/** Renders and waits for the snapshot read to land — the screen shows an empty frame until it does. */
async function open() {
  const result = render(<FlashScreen />);
  await screen.findByRole('heading', { level: 2 });
  return result;
}

/** Every chart on screen, whatever pane is showing. */
function charts() {
  return screen.queryAllByRole('list');
}

describe('FlashScreen — the empty state', () => {
  it('explains what will appear and roughly when on a fresh logbook', async () => {
    await open();

    // Prose rather than an axis with nothing on it: an empty chart says *your rate is zero*, where prose
    // says *there is nothing to divide yet* (`DESIGN.md`'s day-one rule).
    expect(screen.getByText(/nothing to divide yet/i)).toBeInTheDocument();
    expect(screen.getByText(/three or four weeks/i)).toBeInTheDocument();
  });

  it('shows no axis, no reference rule and no selector while it is empty', async () => {
    const { container } = await open();

    expect(charts()).toHaveLength(0);
    expect(container.querySelector('[data-testid="rule"]')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Protection' })).toBeNull();
    expect(screen.queryByText('~50%')).toBeNull();
  });

  it('is empty for a logbook holding only attempts and repeats, not only for an empty one', async () => {
    // The condition is *no first encounters*, not *no ticks*. A session logged entirely as projecting —
    // `attempted` and `sent` repeats — has no rate to report, so `flashRates` returns no group and this
    // screen must say so in prose rather than draw a chart of zero rates.
    await db.ticks.bulkAdd([
      tick(climb.lead('6b'), false, 'attempted'),
      tick(climb.lead('6b'), true, 'attempted'),
      tick(climb.lead('6a'), true, 'sent'),
      tick(climb.boulderFont('6A'), true, 'sent'),
    ]);

    await open();

    expect(screen.getByText(/nothing to divide yet/i)).toBeInTheDocument();
    expect(charts()).toHaveLength(0);
  });

  it('says why a logbook of repeats is empty, since the climber plainly logged something', async () => {
    await open();
    expect(screen.getByText(/tried or sent before are not counted/i)).toBeInTheDocument();
  });
});

describe('FlashScreen — the selector', () => {
  it('carries only the protections that have first encounters', async () => {
    await db.ticks.bulkAdd([
      tick(climb.lead('6a')),
      tick(climb.boulderFont('6A')),
      // Toprope, but never as a first encounter — so it has no rate and gets no entry.
      tick(climb.toprope('6b'), true, 'sent'),
    ]);

    await open();

    expect(screen.getByRole('button', { name: 'Lead' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Boulder' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toprope' })).toBeNull();
  });

  it('renders no selector when one protection qualifies', async () => {
    await db.ticks.bulkAdd([tick(climb.boulderFont('6A')), tick(climb.boulderFont('6B'), false)]);

    await open();

    expect(screen.queryByRole('group', { name: 'Protection' })).toBeNull();
    // And the pane is still shown, labelled — a single chart keeps its scale heading.
    expect(screen.getByRole('list', { name: 'Flash rate, boulder · Font' })).toBeInTheDocument();
  });

  it('names boulder as Boulder', async () => {
    await db.ticks.bulkAdd([tick(climb.lead('6a')), tick(climb.boulderFont('6A'))]);

    await open();

    expect(screen.getByRole('button', { name: 'Boulder' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^none$/i })).toBeNull();
  });

  it('gives auto-belay its own pane rather than folding it into toprope', async () => {
    await db.ticks.bulkAdd([
      tick(climb.lead('6a')),
      tick(climb.toprope('6b')),
      tick(climb.autobelay('5+')),
      tick(climb.autobelay('5+')),
      tick(climb.autobelay('5+'), false),
    ]);

    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Autobelay' }));

    // D6's *segment, never exclude*: auto-belay laps get their own numbers. A flat line near 100% is
    // information, not a reason to hide them.
    const chart = screen.getByRole('list', { name: 'Flash rate, autobelay · French' });
    expect(within(chart).getByText('2/3')).toBeInTheDocument();
    // And nothing from the other panes leaked in.
    expect(screen.getAllByRole('list')).toHaveLength(1);
  });

  it('computes each protection from its own ticks alone', async () => {
    // Pooling a toprope flash with a lead flash at the same grade raises the curve exactly where the
    // crossing is read, so protection is part of the key rather than a filter applied afterwards.
    await db.ticks.bulkAdd([
      tick(climb.lead('6a')),
      tick(climb.lead('6a')),
      tick(climb.lead('6a')),
      tick(climb.toprope('6a'), false),
      tick(climb.toprope('6a'), false),
      tick(climb.toprope('6a'), false),
    ]);

    await open();
    expect(within(screen.getByRole('list')).getByText('3/3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Toprope' }));
    expect(within(screen.getByRole('list')).getByText('0/3')).toBeInTheDocument();
  });
});

describe('FlashScreen — the default pane', () => {
  it('opens on lead when lead has first encounters', async () => {
    await db.ticks.bulkAdd([tick(climb.boulderFont('6A')), tick(climb.lead('6a'))]);

    await open();

    expect(screen.getByRole('button', { name: 'Lead' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('list', { name: 'Flash rate, lead · French' })).toBeInTheDocument();
  });

  it('opens on the first protection with data when lead has none', async () => {
    // §4.2's unconditional "lead by default" would show a boulderer an empty pane with their data one
    // tap away — which reads as "you have no numbers" and is false.
    await db.ticks.bulkAdd([tick(climb.boulderFont('6A')), tick(climb.toprope('6a'))]);

    await open();

    expect(screen.getByRole('button', { name: 'Toprope' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens on boulder for a boulder-only logbook, with no selector to tap', async () => {
    await db.ticks.bulkAdd([tick(climb.boulderFont('6A')), tick(climb.boulderFont('6B'), false)]);

    await open();

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('boulder · Font');
    expect(screen.queryByRole('group', { name: 'Protection' })).toBeNull();
  });

  it('never shows an empty pane while any data exists', async () => {
    await db.ticks.bulkAdd([
      tick(climb.lead('6a')),
      tick(climb.toprope('6b')),
      tick(climb.autobelay('5+')),
      tick(climb.boulderFont('6A')),
      tick(climb.boulderFrench('6a')),
    ]);

    await open();

    for (const name of ['Lead', 'Toprope', 'Autobelay', 'Boulder']) {
      await userEvent.click(screen.getByRole('button', { name }));
      const lists = screen.getAllByRole('list');
      expect(lists.length).toBeGreaterThan(0);
      for (const list of lists) {
        expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0);
      }
    }
  });

  it('shows one chart per scale in the selected pane', async () => {
    // Boulder alone spans two scales under today's seed — Font at the Kiipeilyareena sites, French at
    // Tampere (D17) — and a Font↔French conversion is deferred, so two scales are two charts.
    await db.ticks.bulkAdd([tick(climb.boulderFont('6A')), tick(climb.boulderFrench('6a'))]);

    await open();

    expect(screen.getByRole('list', { name: 'Flash rate, boulder · Font' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Flash rate, boulder · French' })).toBeInTheDocument();
  });
});

describe('FlashScreen — what it must not show', () => {
  it("names no grade as the climber's level", async () => {
    await db.ticks.bulkAdd([
      tick(climb.lead('6a')),
      tick(climb.lead('6a')),
      tick(climb.lead('6a')),
      tick(climb.lead('6b'), false),
      tick(climb.lead('6b'), false),
      tick(climb.lead('6b')),
      tick(climb.lead('6c'), false),
      tick(climb.lead('6c'), false),
      tick(climb.lead('6c'), false),
    ]);

    const { container } = await open();

    // §4.2 puts the crossing on the reader precisely because the sample sizes are thin. The mock carried
    // "You cross 50% at 6b+"; it is gone on purpose, because it would state a conclusion with more
    // confidence than the data supports.
    expect(container.textContent).not.toMatch(
      /your level|real level|you cross|crossing|limit grade/i,
    );
  });

  it('shows no second analytic', async () => {
    await db.ticks.bulkAdd([tick(climb.lead('6a')), tick(climb.boulderFont('6A'))]);

    const { container } = await open();

    // Phase 0 ships exactly one analytic and holding to that is the phase's stated main risk. Vertical
    // metres additionally cannot be computed — wall heights are seeded absent (§12 Q1) — and `angle` and
    // `holds` are descriptive rather than analytic, since annotations are recorded while describing a
    // climb and any metric keyed on them skews toward sends (D19, D21).
    expect(container.textContent).not.toMatch(
      /pyramid|volume|metre|meter|\bkm\b|trend|plateau|median|slab|overhang|crimp|sloper/i,
    );
  });

  it('offers no window control, since Phase 0 holds no data older than the install', async () => {
    await db.ticks.bulkAdd([tick(climb.lead('6a'))]);

    await open();

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    // The one control on the screen is the protection selector, and here it is not even that.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('writes nothing when a row is interacted with', async () => {
    await db.ticks.bulkAdd([
      tick(climb.lead('6a')),
      tick(climb.lead('6a'), false),
      tick(climb.lead('6a')),
    ]);

    await open();
    const before = await db.ticks.toArray();

    const row = screen.getByLabelText('6a, 2 of 3 flashed');
    await userEvent.click(row);
    await userEvent.click(within(row).getByText('2/3'));

    // Read-only surface: no correction control, and a go is repaired from the session detail, which
    // stays the only repair path (D23). `updated_at` is compared too — a write that preserved the row
    // count would still be a write.
    expect(await db.ticks.toArray()).toEqual(before);
    expect(row.closest('button')).toBeNull();
  });

  it('presents no correction control on any row', async () => {
    await db.ticks.bulkAdd([tick(climb.lead('6a')), tick(climb.boulderFont('6A'))]);

    await open();

    // The selector's four entries are the only buttons this screen has; a row is an `<li>` and nothing
    // more, so there is nothing to long-press or tap into a sheet.
    for (const list of screen.getAllByRole('list')) {
      expect(within(list).queryAllByRole('button')).toHaveLength(0);
    }
  });
});

describe('FlashScreen — a read that fails', () => {
  it('says the read failed rather than that there is nothing to divide', async () => {
    // A genuine failure rather than a mocked one: a closed Dexie rejects every read, which is the same
    // rejection the screen's `.then(_, handler)` catches in production. Reopened in `finally` because the
    // `db` singleton is shared with every other suite in the run.
    await db.ticks.bulkPut([tick(climb.lead('6a'), true), tick(climb.lead('6a'), true)]);
    db.close();

    try {
      render(<FlashScreen />);

      expect(await screen.findByText(/could not read your logbook/i)).toBeInTheDocument();
      // The distinction the branch exists for. The day-one prose tells a climber to come back in three
      // or four weeks, which to someone whose goes are on disk is a false claim about their own logbook.
      expect(screen.queryByText(/nothing to divide yet/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/three or four weeks/i)).not.toBeInTheDocument();
      // And it says the data survived, which is the reassurance the day-one prose would deny.
      expect(screen.getByText(/still saved/i)).toBeInTheDocument();
    } finally {
      await db.open();
    }
  });

  it('shows the day-one prose when the read succeeds and finds nothing', async () => {
    // The other side of the same branch: an empty logbook is not a failure, and must not read as one.
    render(<FlashScreen />);

    expect(await screen.findByText(/nothing to divide yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not read your logbook/i)).not.toBeInTheDocument();
  });
});

describe('the chart dependency', () => {
  it('adds no charting or plotting library', async () => {
    const { readFileSync } = await import('node:fs');
    const manifest: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
    const { dependencies, devDependencies } = manifest as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const installed = [...Object.keys(dependencies), ...Object.keys(devDependencies)];

    // D25. The mark is a `div` with a background and a nested `div` with a percentage width; install
    // weight is paid up front because the service worker precaches the bundle before first use, and a
    // canvas chart would make this the one Phase 0 surface the suite cannot query. Asserted against the
    // manifest because the argument is about what is *shipped*, not about what this screen imports.
    expect(
      installed.filter((name) =>
        /recharts|uplot|chart\.js|chartjs|^d3|victory|visx|nivo|apexcharts|echarts|plotly|highcharts|lightweight-charts/.test(
          name,
        ),
      ),
    ).toEqual([]);
  });
});
