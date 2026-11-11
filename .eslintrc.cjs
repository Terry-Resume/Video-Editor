module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: ['eslint:recommended'],
  overrides: [{ files: ['gate.js'], parserOptions: { sourceType: 'script' } }],
  rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  ignorePatterns: ['dist/', 'node_modules/'],
}
