// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Edge Functions memakai runtime Deno, bukan bundler React Native.
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);
