/**
 * How this screen's charts and its selector name themselves.
 *
 * **Separate from `groups.ts`'s `groupLabel`, on purpose.** That one names a `(discipline, scale)` pair
 * for a session card — `rope · French`, `boulder · Font` — and a card must not start reading
 * `lead · French`, because a visit is not segmented by protection. Sharing one function would mean one
 * of the two surfaces getting the other's vocabulary the next time either is edited, so the reasoning
 * transfers and the function does not.
 *
 * Both halves of the wording still come from `format/climbing.ts`. That module is the single authority
 * on *`none` reads as boulder* (§7.4), and this file only decides where the word goes and how it is
 * capitalised.
 */

import type { ScaleId } from '@tickd/grade-spec';
import type { Protection } from '../../db/types.ts';
import { protectionLabel } from '../../format/climbing.ts';

/**
 * `font` → `Font`, `french` → `French`.
 *
 * Notations, so they read as the proper nouns they are rather than as enum values — the call
 * `groupLabel` already made, and this file follows its wording rather than inventing a second one.
 *
 * A `switch` where `groupLabel` uses a ternary, and the difference is the point: a scale added to
 * `scales.yaml` makes this stop compiling — not every path returns — where the ternary would quietly
 * render UIAA grades as `French`. `priorLabel` is switched over its union for the same reason.
 */
export function notationLabel(scale: ScaleId): string {
  switch (scale) {
    case 'font':
      return 'Font';
    case 'french':
      return 'French';
  }
}

/**
 * How one chart names itself: the protection, then the notation its grades are written in.
 *
 * **The scale is named on every chart, including when the selected protection has only one** — the
 * deliberate divergence from `SessionsScreen`, which drops a heading that never varies. There the pills
 * sit inside a visit that supplies the context; here the grade column *is* the axis and nothing else in
 * the frame distinguishes Font `6A` from French `6a` (§7.3). An unlabelled chart is not merely terser,
 * it is unreadable in the case the seed guarantees: boulder alone spans two scales, Font at the
 * Kiipeilyareena sites and French at Tampere (D17). Stated here so the inconsistency with the session
 * list is not later reconciled by deleting the label.
 *
 * **Protection rather than discipline**, which is what makes this the `(protection, scale)` label
 * design.md drew. For `none` the protection *is* the discipline (§7.4), so nothing is lost there; naming
 * the protection also makes a chart self-describing when it is read out of the pane that selected it, by a
 * screen reader or in a screenshot.
 *
 * **This label is therefore not injective on the group key, and that is accepted rather than overlooked.**
 * The key is `(discipline, scale, protection)`; this drops one third of it. A pane holding both a
 * sport-lead-French group and a trad-lead-French group would show two charts headed `lead · French`, with
 * the same `aria-label` on both lists. *The indoor UI cannot write such a row* — `trad` never appears in it
 * (§7.7) — but an imported file can, since the importer deliberately does no per-field validation and the
 * schema marker hashes field names rather than enum domains (D24). So the hazard is real on disk and
 * unreachable through the app, which is exactly the distinction `flashRate.ts`'s `isProtection` exists for.
 *
 * It is accepted anyway, and the difference from that hazard is the point. An unrecognised `protection`
 * sorts ahead of lead and silently becomes the pane the screen opens on — it changes *which numbers you
 * are looking at*. This changes a heading. Both charts still compute from their own group alone, no count
 * is pooled, no rate is wrong, and the two are distinguishable by their grade rows; only the words above
 * them repeat. Adding `sport`/`trad` to the heading — or adding it conditionally, when a pane holds two
 * disciplines for one `(protection, scale)` — would put a word that never varies in front of every indoor
 * climber to disambiguate a case none of them can reach. If Phase 1 ever ships outdoor trad, this is the
 * line to revisit.
 *
 * Lower case, because the caller uppercases it in CSS the way a session card's group heading does. Safe
 * here and nowhere near a grade: `text-transform` on `grade_raw` is what turns French `6a` into Font
 * `6A` (§7.3, `DESIGN.md` §2), and these are words, not labels.
 */
export function chartLabel(group: { protection: Protection; scale: ScaleId }): string {
  return `${protectionLabel(group.protection)} · ${notationLabel(group.scale)}`;
}

/**
 * How one protection names itself in the selector: `Lead`, `Toprope`, `Autobelay`, `Boulder`.
 *
 * Capitalised in code rather than by `capitalize`, because the words are the control's accessible names
 * as well as its glyphs — a CSS transform would leave a test and a screen reader hearing `boulder` while
 * the screen said `Boulder`, and the requirement is about what the entry *reads as*.
 *
 * Derived from `protectionLabel` rather than switched over again, so `none` reads as `Boulder` for the
 * one reason it reads as `boulder` everywhere else and cannot come to read as `None` here alone.
 * `autobelay` keeps the stored spelling: `ProtectionGroup` prints it that way on the logging screen, and
 * a second spelling of one enum value is how two controls for the same field start disagreeing.
 */
export function protectionTab(protection: Protection): string {
  const word = protectionLabel(protection);
  return word.charAt(0).toUpperCase() + word.slice(1);
}
