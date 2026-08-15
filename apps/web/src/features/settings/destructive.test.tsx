import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from './SettingsScreen.tsx';
import { buildExport } from './logbookFile.ts';
import { db, SCHEMA_MARKER } from '../../db/schema.ts';
import { seedVenues } from '../../db/seed.ts';
import { startSession } from '../../db/sessions.ts';
import { logTick } from '../../db/ticks.ts';

/**
 * Renders the screen directly rather than through the router.
 *
 * The destructive paths are the screen's own behaviour, and `reload` has to be observed rather than
 * performed — jsdom has no navigation. Passing it in is why it is a prop.
 */
function renderSettings(reload = vi.fn()) {
  render(<SettingsScreen now={new Date('2026-08-15T10:38:00.000Z')} reload={reload} />);
  return reload;
}

/** A file the file input will accept, built from whatever the database currently holds. */
async function exportedFile(): Promise<File> {
  const file = await buildExport(db, new Date('2026-08-14T18:00:00.000Z'));
  return new File([JSON.stringify(file)], 'tickd-2026-08-14.json', { type: 'application/json' });
}

async function seedOneGo() {
  await seedVenues(db);
  const [venue] = await db.venues.toArray();
  if (!venue) throw new Error('expected the seed venues');
  const session = await startSession(db, venue.id, new Date('2026-08-08T17:00:00.000Z'));
  await logTick(db, {
    session_id: session.id,
    discipline: 'sport',
    protection: 'lead',
    grade_scale: 'french',
    grade_raw: '6a',
    outcome: { is_send: true, prior_experience: 'none' },
  });
}

beforeEach(async () => {
  globalThis.localStorage.clear();
  await db.venues.clear();
  await db.sessions.clear();
  await db.ticks.clear();
  Object.defineProperty(globalThis.navigator, 'storage', {
    value: { persist: vi.fn(), persisted: vi.fn().mockResolvedValue(true) },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'storage');
  vi.restoreAllMocks();
});

describe('importing', () => {
  it('refuses a file that is not an export, without opening a dialog', async () => {
    await seedOneGo();
    renderSettings();

    await userEvent.upload(
      await screen.findByLabelText('Import JSON'),
      new File(['nonsense'], 'notes.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a tickd export/i);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await db.ticks.count()).toBe(1);
  });

  it('refuses a marker from another schema, and says exports are not upgraded', async () => {
    await seedOneGo();
    const original = await buildExport(db, new Date());
    const foreign = new File(
      [JSON.stringify({ ...original, marker: 'tickd.phase0-deadbeef' })],
      'old.json',
    );
    renderSettings();

    await userEvent.upload(await screen.findByLabelText('Import JSON'), foreign);

    expect(await screen.findByRole('alert')).toHaveTextContent(/different version/i);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('refuses an edited file, and says so in those words', async () => {
    await seedOneGo();
    const original = await buildExport(db, new Date());
    const edited = new File(
      [JSON.stringify(original).replace('"grade_raw":"6a"', '"grade_raw":"7a"')],
      'edited.json',
    );
    renderSettings();

    await userEvent.upload(await screen.findByLabelText('Import JSON'), edited);

    expect(await screen.findByRole('alert')).toHaveTextContent(/modified since it was exported/i);
    expect((await db.ticks.toArray())[0]?.grade_raw).toBe('6a');
  });

  it('says a file could not be read rather than calling it a bad export', async () => {
    // Android revokes a content URI freely, so the picker can hand over a file the disk then will not
    // produce. Calling that "not a tickd export" sends the user looking for a different file.
    await seedOneGo();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(File.prototype, 'text').mockRejectedValue(new Error('gone'));
    renderSettings();

    await userEvent.upload(await screen.findByLabelText('Import JSON'), new File(['{}'], 'x.json'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be read/i);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await db.ticks.count()).toBe(1);
  });

  it('says the logbook survived when the replace itself fails', async () => {
    // The transaction is all-or-nothing, so the previous logbook is still there. Without saying so the
    // dialog just sits open and the obvious next move is to press Replace again.
    await seedOneGo();
    const file = await exportedFile();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(db, 'transaction').mockRejectedValue(new Error('quota exhausted'));
    const reload = renderSettings();

    await userEvent.upload(await screen.findByLabelText('Import JSON'), file);
    await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/left exactly as it was/i);
    expect(reload).not.toHaveBeenCalled();
  });

  it('confirms with counts from both the file and the database', async () => {
    await seedOneGo();
    const file = await exportedFile();
    // The database now holds more than the file does, so the two numbers must differ in the dialog.
    const [venue] = await db.venues.toArray();
    if (!venue) throw new Error('expected the seed venues');
    const session = await db.sessions.toArray();
    await logTick(db, {
      session_id: session[0]?.id ?? '',
      discipline: 'boulder',
      protection: 'none',
      grade_scale: 'font',
      grade_raw: '6A',
      outcome: { is_send: false, prior_experience: 'none' },
    });

    renderSettings();
    await userEvent.upload(await screen.findByLabelText('Import JSON'), file);

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(/this file holds 1 go in 1 session/i);
    expect(dialog).toHaveTextContent(/2 ticks in 1 session on this phone will be deleted/i);
  });

  it('does not threaten a loss when there is nothing to lose', async () => {
    // The day-one restore: a fresh install, or the new origin after the Phase 1 move. Found in a
    // browser, where the dialog read "0 ticks in 0 sessions will be deleted. There is no undo."
    await seedOneGo();
    const file = await exportedFile();
    await db.ticks.clear();
    await db.sessions.clear();
    renderSettings();

    await userEvent.upload(await screen.findByLabelText('Import JSON'), file);

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(/nothing on this phone to replace/i);
    expect(dialog).not.toHaveTextContent(/no undo/i);
  });

  it('writes nothing when the confirmation is cancelled', async () => {
    await seedOneGo();
    const file = await exportedFile();
    await db.ticks.clear();
    const reload = renderSettings();

    await userEvent.upload(await screen.findByLabelText('Import JSON'), file);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(await db.ticks.count()).toBe(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it('replaces the logbook and reloads when confirmed', async () => {
    await seedOneGo();
    const file = await exportedFile();
    await db.ticks.clear();
    await db.sessions.clear();
    const reload = renderSettings();

    await userEvent.upload(await screen.findByLabelText('Import JSON'), file);
    await userEvent.click(await screen.findByRole('button', { name: 'Replace' }));

    expect(await db.ticks.count()).toBe(1);
    expect(await db.sessions.count()).toBe(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('offers taking an export before replacing', async () => {
    // The only undo a replace can have is a file taken beforehand.
    await seedOneGo();
    const file = await exportedFile();
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn().mockReturnValue('blob:tickd'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    renderSettings();
    await userEvent.upload(await screen.findByLabelText('Import JSON'), file);
    await userEvent.click(await screen.findByRole('button', { name: 'Export first' }));

    expect(click).toHaveBeenCalledTimes(1);
    // Still open: exporting is preparation, not an answer to the question being asked.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});

describe('deleting', () => {
  it('states what goes and what comes back', async () => {
    await seedOneGo();
    renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: /delete my logbook/i }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(/1 tick in 1 session will be deleted/i);
    expect(dialog).toHaveTextContent(/gyms come back on the next launch/i);
    expect(dialog).toHaveTextContent(/settings are kept/i);
  });

  it('does not threaten a loss when there is nothing to lose', async () => {
    // The same rule the import confirmation follows. A fresh install is exactly where someone presses
    // this to be sure, and "0 ticks in 0 sessions will be deleted. There is no undo." is both true and
    // alarming about nothing.
    await seedVenues(db);
    renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: /delete my logbook/i }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(/nothing on this phone to delete/i);
    expect(dialog).not.toHaveTextContent(/no undo/i);
  });

  it('writes nothing when cancelled', async () => {
    await seedOneGo();
    const reload = renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: /delete my logbook/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(await db.ticks.count()).toBe(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('empties all three tables and reloads when confirmed', async () => {
    await seedOneGo();
    const reload = renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: /delete my logbook/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await db.ticks.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.venues.count()).toBe(0);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('leaves the preferences alone', async () => {
    // They are device settings, not the logbook: deletion has exactly the reach an export has.
    await seedOneGo();
    globalThis.localStorage.setItem('tickd.theme', 'light');
    renderSettings();

    await userEvent.click(await screen.findByRole('button', { name: /delete my logbook/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(globalThis.localStorage.getItem('tickd.theme')).toBe('light');
  });
});

describe('the marker', () => {
  it('is what a foreign file is compared against', () => {
    // Guards the refusal against the marker being silently dropped from the envelope: if this ever
    // reads undefined, every file would import and D7's substitute for migrations would be gone.
    expect(SCHEMA_MARKER).toMatch(/^tickd\.phase0-[0-9a-f]{8}$/);
  });
});
