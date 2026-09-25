// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/setupTests.ts'],
    // src/lib/supabase.ts throws at module load if these are unset, so without
    // them the suite only passes on a machine that happens to have a populated
    // .env.local — which is why the first CI run of the new Test step went red.
    // Pinning placeholders here also guarantees a test can never reach a real
    // Supabase project: everything that exercises Supabase mocks the client,
    // so these only need to be well-formed, not valid.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-not-a-real-credential',
    },
    // Supabase edge functions are Deno (https:// + npm: imports) and ship their
    // own `deno test` suite — keep them out of the vitest (happy-dom) run.
    exclude: [...configDefaults.exclude, 'supabase/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    // Don't realpath through pnpm symlinks. The default (false) calls
    // fs.realpathSync which on Windows returns the on-disk casing
    // (e.g. `Desktop` uppercase). When the shell cwd is the user's
    // typed lowercase (`desktop`), Vite's path-cache and Node's CJS
    // resolver disagree, so react-dom's internal require('react') and
    // the test's ESM import of 'react' end up as two separate module
    // instances. Hooks then crash with "Invalid hook call".
    preserveSymlinks: true
  }
});
