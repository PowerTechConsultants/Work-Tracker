const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.js', 'src/**/*.js', 'src/**/*.d.ts'],
    files: ['src/**/*.ts'],


    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true
      },

      globals: {
        ...globals.node,
        process: 'readonly',
        console: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': ['error', { typeof: true }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
];