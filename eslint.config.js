// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const designTokensPlugin = require('./scripts/eslint-design-tokens.cjs');
const designTokenRatchet = require('./scripts/design-token-ratchet.json');

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions memakai runtime Deno, bukan bundler React Native.
    ignores: ['dist/*', 'supabase/functions/**'],
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      'design-tokens': designTokensPlugin,
    },
    rules: {
      'design-tokens/no-hardcoded-values': ['error', { ratchet: designTokenRatchet }],
      'design-tokens/no-alert-alert': ['error', { ratchet: designTokenRatchet }],
    },
  },
]);
