import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const expoConfig = require('eslint-config-expo/flat');
const designTokensPlugin = require('./eslint-design-tokens.cjs');

const RATCHET_PATH = path.resolve(process.cwd(), 'scripts/design-token-ratchet.json');

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    ...expoConfig,
    {
      ignores: ['dist/*', 'supabase/functions/**'],
    },
    {
      files: ['src/**/*.{ts,tsx,js,jsx}'],
      plugins: {
        'design-tokens': designTokensPlugin,
      },
      rules: {
        'design-tokens/no-hardcoded-values': ['error', { ratchet: {} }],
        'design-tokens/no-alert-alert': ['error', { ratchet: {} }],
      },
    },
  ],
});

const results = await eslint.lintFiles(['src']);
const hardcodedValues = {};
const alertCalls = {};
const forbiddenViolations = [];

for (const result of results) {
  const relPath = path.relative(process.cwd(), result.filePath).split(path.sep).join('/');
  let hcCount = 0;
  let alertCount = 0;

  for (const msg of result.messages) {
    if (msg.ruleId === 'design-tokens/no-hardcoded-values') hcCount += 1;
    if (msg.ruleId === 'design-tokens/no-alert-alert') alertCount += 1;
  }

  if (
    (hcCount > 0 || alertCount > 0) &&
    (relPath.startsWith('src/theme/') ||
      relPath.startsWith('src/components/ui/') ||
      relPath === 'src/components/app-loading-screen.tsx')
  ) {
    forbiddenViolations.push({ relPath, hcCount, alertCount });
  }

  if (hcCount > 0) hardcodedValues[relPath] = hcCount;
  if (alertCount > 0) alertCalls[relPath] = alertCount;
}

if (forbiddenViolations.length > 0) {
  console.error('Found design-token violations in clean foundation files:', forbiddenViolations);
  process.exit(1);
}

const sortObject = (obj) =>
  Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

const payload = {
  $comment:
    'Baseline ratchet untuk migrasi Calm Utility (Tahap 1 -> Tahap 3). File di src/theme/** dan src/components/ui/** harus 0 pelanggaran.',
  hardcodedValues: sortObject(hardcodedValues),
  alertCalls: sortObject(alertCalls),
};

// Validasi tidak ada path mati bila ratchet sudah ada sebelumnya.
if (existsSync(RATCHET_PATH)) {
  const prev = JSON.parse(readFileSync(RATCHET_PATH, 'utf8'));
  for (const key of Object.keys(prev.hardcodedValues || {})) {
    if (!existsSync(path.resolve(process.cwd(), key))) {
      console.warn('Removing missing path from ratchet:', key);
    }
  }
}

writeFileSync(RATCHET_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const totalHc = Object.values(hardcodedValues).reduce((sum, n) => sum + n, 0);
const totalAlert = Object.values(alertCalls).reduce((sum, n) => sum + n, 0);
console.log(
  `Generated ratchet: ${Object.keys(hardcodedValues).length} files (${totalHc} hardcoded values), ${Object.keys(alertCalls).length} files (${totalAlert} Alert.alert calls).`,
);
