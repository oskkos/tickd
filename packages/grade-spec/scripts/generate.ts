/**
 * Generates `src/generated/scales.ts` from `scales.yaml`.
 *
 * Run directly by Node — v24 strips TypeScript types natively, so this needs no build step and no
 * `tsx`. See the justfile's `codegen` recipe.
 *
 * Two principles, both from design.md:
 *
 *   - **Emit data, not logic.** The output is label tuples, the literal types derived from them, and
 *     the spec version. Every function lives in hand-written, tested code.
 *   - **Validate, never coerce.** A spec that is wrong should fail loudly here rather than produce a
 *     module that looks right.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(HERE, '..');
const SPEC_PATH = join(PACKAGE_ROOT, 'scales.yaml');
const OUTPUT_PATH = join(PACKAGE_ROOT, 'src', 'generated', 'scales.ts');

type ScaleDefinition = { count: number; labels: string[] };
type Spec = { version: number; scales: Record<string, ScaleDefinition> };

class SpecError extends Error {}

function fail(message: string): never {
  throw new SpecError(message);
}

/**
 * Every check here exists because the failure it catches is otherwise silent in the generated
 * output.
 */
function validate(raw: unknown): Spec {
  if (typeof raw !== 'object' || raw === null) {
    fail('scales.yaml did not parse to an object');
  }
  const spec = raw as Partial<Spec>;

  if (typeof spec.version !== 'number' || !Number.isInteger(spec.version)) {
    fail('`version` must be an integer');
  }
  if (typeof spec.scales !== 'object' || spec.scales === null) {
    fail('`scales` must be a mapping of scale id to definition');
  }

  const ids = Object.keys(spec.scales);
  if (ids.length === 0) {
    fail('`scales` is empty');
  }

  for (const id of ids) {
    if (!/^[a-z][a-z0-9_]*$/.test(id)) {
      fail(`scale id "${id}" must be lower snake case — it becomes a TypeScript literal type`);
    }
    const definition = spec.scales[id];
    if (typeof definition !== 'object' || definition === null) {
      fail(`scale "${id}" must be an object with \`count\` and \`labels\``);
    }
    const { count, labels } = definition as Partial<ScaleDefinition>;

    if (!Array.isArray(labels)) {
      fail(`scale "${id}" has no \`labels\` list`);
    }
    if (labels.length === 0) {
      fail(`scale "${id}" has an empty \`labels\` list`);
    }

    // The reason every label is quoted in the YAML: `4` and `5` parse as integers otherwise, and a
    // coerced label is indistinguishable from a correct one downstream.
    labels.forEach((label, index) => {
      if (typeof label !== 'string') {
        fail(
          `scale "${id}" label at index ${String(index)} is ${typeof label}, not a string — ` +
            `quote it in scales.yaml (got ${JSON.stringify(label)})`,
        );
      }
      if (label !== label.trim() || label.length === 0) {
        fail(`scale "${id}" label ${JSON.stringify(label)} has surrounding whitespace or is empty`);
      }
    });

    const duplicates = labels.filter((label, index) => labels.indexOf(label) !== index);
    if (duplicates.length > 0) {
      fail(`scale "${id}" repeats ${JSON.stringify([...new Set(duplicates)])}`);
    }

    // A declared count is what makes a dropped line a build failure rather than a quietly shorter
    // scale.
    if (typeof count !== 'number' || !Number.isInteger(count)) {
      fail(`scale "${id}" must declare an integer \`count\``);
    }
    if (count !== labels.length) {
      fail(
        `scale "${id}" declares count ${String(count)} but lists ${String(labels.length)} labels`,
      );
    }
  }

  return spec as Spec;
}

function emit(spec: Spec): string {
  const ids = Object.keys(spec.scales).sort();
  const lines: string[] = [
    '// GENERATED FILE — do not edit.',
    '//',
    '// Source: packages/grade-spec/scales.yaml',
    '// Regenerate: just codegen',
    '//',
    '// Committed deliberately, so typechecking the web app needs no codegen step (CONCEPT.md §8).',
    '// `just check` fails when this file disagrees with the YAML.',
    '',
    `export const SPEC_VERSION = ${String(spec.version)} as const;`,
    '',
  ];

  for (const id of ids) {
    const definition = spec.scales[id];
    if (definition === undefined) {
      fail(`scale "${id}" vanished between validation and emit`);
    }
    const constName = `${id.toUpperCase()}_LABELS`;
    const typeName = `${id.charAt(0).toUpperCase()}${id.slice(1)}Label`;
    lines.push(
      `export const ${constName} = [`,
      ...definition.labels.map((label) => `  '${label}',`),
      '] as const;',
      '',
      `export type ${typeName} = (typeof ${constName})[number];`,
      '',
    );
  }

  lines.push(
    'export const SCALE_IDS = [',
    ...ids.map((id) => `  '${id}',`),
    '] as const;',
    '',
    'export type ScaleId = (typeof SCALE_IDS)[number];',
    '',
    'export const LABELS_BY_SCALE = {',
    ...ids.map((id) => `  ${id}: ${id.toUpperCase()}_LABELS,`),
    '} as const;',
    '',
  );

  return lines.join('\n');
}

function main(): void {
  const spec = validate(parse(readFileSync(SPEC_PATH, 'utf8')));
  const output = emit(spec);

  // `--check` prints nothing and exits non-zero on drift. It never writes, so it is safe on a dirty
  // tree and cannot be confused with uncommitted work.
  if (process.argv.includes('--check')) {
    let committed: string;
    try {
      committed = readFileSync(OUTPUT_PATH, 'utf8');
    } catch {
      console.error(`drift: ${OUTPUT_PATH} does not exist. Run: just codegen`);
      process.exit(1);
    }
    if (committed !== output) {
      console.error(
        `drift: the committed generated module disagrees with scales.yaml. Run: just codegen`,
      );
      process.exit(1);
    }
    console.log('grade-spec: generated module is up to date');
    return;
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, output, 'utf8');
  console.log(`grade-spec: wrote ${OUTPUT_PATH}`);
}

try {
  main();
} catch (error) {
  if (error instanceof SpecError) {
    console.error(`scales.yaml is invalid: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
