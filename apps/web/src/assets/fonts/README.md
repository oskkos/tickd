# Fonts

Self-hosted and committed. Two independent reasons, both in `DESIGN.md` §2: the service worker has to
precache them so an offline launch renders in the real faces, and the GDPR ruling against
CDN-embedded Google Fonts rules out loading them from a third party.

| File                          | Family  | Weight | Subset    |
| ----------------------------- | ------- | ------ | --------- |
| `poppins-600-latin.woff2`     | Poppins | 600    | latin     |
| `poppins-600-latin-ext.woff2` | Poppins | 600    | latin-ext |
| `lato-400-latin.woff2`        | Lato    | 400    | latin     |
| `lato-400-latin-ext.woff2`    | Lato    | 400    | latin-ext |

**Subsetting:** these are Google Fonts' own per-`unicode-range` subsets, taken from the `css2` API
rather than re-subset locally. `latin` covers Finnish — `ä` and `ö` sit inside U+0000–00FF — and
`latin-ext` is carried for other European venue names. Together they are ~43 KB, small enough that the
offline requirement costs nothing. The `unicode-range` declarations in `src/index.css` must stay in
step with these files, or the browser will download both subsets when it needs only one.

**Licence:** both families are SIL Open Font License 1.1. Full texts are in `OFL-poppins.txt` and
`OFL-lato.txt`.
