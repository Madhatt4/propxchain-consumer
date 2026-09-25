// ESLint 8.57 + @typescript-eslint v6 => eslintrc format, not flat config.
// The `lint` script passes `--ext ts,tsx`, which is eslintrc-style; keep both
// in step if either is changed. Upgrading to ESLint 9 / flat config / tseslint
// v8 is deliberately a separate task — it changes the config format, the plugin
// APIs and `--ext` handling all at once.
//
// Type-aware linting (`parserOptions.project`) is intentionally off in this
// first pass: it is much slower and surfaces a different, larger class of
// errors. Get green on the syntactic rules first.
module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react-refresh'],
  ignorePatterns: [
    'dist', 'dist-backup', 'node_modules', 'coverage', '.dfx',
    'graphify-out', '_design-reference', 'design_handoff_*',
    'public', 'scripts/*.mjs',
    '.eslintrc.cjs',
  ],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // TODO(2026-07-30): demoted to warn while the 263 pre-existing `any`s in
    // older service code are burnt down. Restore to 'error' once at zero —
    // 73 of them are in src/services/icp.service.ts, which is its own task.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    // The tree already marks deliberately-unused bindings with a leading `_`
    // (unused route params, interface-conformance args, destructure-to-omit).
    // Honour that convention rather than rewriting ~30 call sites that are
    // already self-documenting.
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
    }],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
  },
  overrides: [
    {
      // Tests may use `any` for fixtures and console for diagnostics.
      files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
    {
      // Deno edge functions: different globals, remote URL imports, and they
      // are not part of the Vite tsconfig project.
      files: ['supabase/functions/**/*.ts'],
      env: { browser: false, node: false },
      globals: { Deno: 'readonly' },
      rules: { 'no-console': 'off' },
    },
    {
      // The logger IS the console wrapper. Every no-console finding in the tree
      // is here; nothing else in src/ calls console directly, and this override
      // is what keeps it that way before the repo goes public.
      files: ['src/utils/logger.ts'],
      rules: { 'no-console': 'off' },
    },
  ],
};
