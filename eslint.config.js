// ESLint (flat config). Run with `npm run lint`.
// The game is plain browser ES modules (no build step), so the rules focus on catching real bugs:
// undefined names, unused code, duplicate keys, unreachable code and the like.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['android/**', 'node_modules/**', 'dist/**', 'web/data/**'] },
  js.configs.recommended,
  {
    files: ['web/js/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-cond-assign': ['error', 'except-parens'],
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-prototype-builtins': 'off',
    },
  },
  {
    files: ['tests/**/*.js', 'eslint.config.js', 'playwright.config.js', 'scripts/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
];
