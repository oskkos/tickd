// GENERATED FILE — do not edit.
//
// Source: packages/grade-spec/scales.yaml
// Regenerate: just codegen
//
// Committed deliberately, so typechecking the web app needs no codegen step (CONCEPT.md §8).
// `just check` fails when this file disagrees with the YAML.

export const SPEC_VERSION = 1 as const;

export const FONT_LABELS = [
  '4',
  '4+',
  '5',
  '5+',
  '6A',
  '6A+',
  '6B',
  '6B+',
  '6C',
  '6C+',
  '7A',
  '7A+',
  '7B',
  '7B+',
  '7C',
  '7C+',
  '8A',
  '8A+',
  '8B',
  '8B+',
  '8C',
  '8C+',
  '9A',
] as const;

export type FontLabel = (typeof FONT_LABELS)[number];

export const FRENCH_LABELS = [
  '4',
  '4+',
  '5',
  '5+',
  '6a',
  '6a+',
  '6b',
  '6b+',
  '6c',
  '6c+',
  '7a',
  '7a+',
  '7b',
  '7b+',
  '7c',
  '7c+',
  '8a',
  '8a+',
  '8b',
  '8b+',
  '8c',
  '8c+',
  '9a',
  '9a+',
  '9b',
  '9b+',
  '9c',
] as const;

export type FrenchLabel = (typeof FRENCH_LABELS)[number];

export const SCALE_IDS = [
  'font',
  'french',
] as const;

export type ScaleId = (typeof SCALE_IDS)[number];

export const LABELS_BY_SCALE = {
  font: FONT_LABELS,
  french: FRENCH_LABELS,
} as const;
