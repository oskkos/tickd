import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage'] },
  js.configs.recommended,

  // `configs.flat[...]` is the flat-config shape. The top-level `configs.recommended*` entries in
  // eslint-plugin-react-hooks 7 still carry a legacy string-array `plugins` key, which ESLint 10
  // rejects outright.
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite,

  {
    // Type-aware linting applies only to files the TS project actually includes.
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    // Config files run in Node and are outside the TS project, so typed rules cannot apply.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['vite.config.ts', 'vitest.setup.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'react-refresh/only-export-components': 'off' },
  },
);
