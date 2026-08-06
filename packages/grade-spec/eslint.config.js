import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['src/generated'] },
  js.configs.recommended,

  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    // `noUncheckedIndexedAccess` makes every index access optional, and a test that has just asserted
    // a list's length knows better. Non-null assertions are appropriate here and nowhere else.
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },

  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
);
