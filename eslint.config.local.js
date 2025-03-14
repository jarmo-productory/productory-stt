// Local development ESLint Flat Config
// This is a more relaxed version of eslint.config.js for local development

import nextPlugin from 'eslint-plugin-next';
import importPlugin from 'eslint-plugin-import';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';

export default [
  // Base configurations
  {
    ignores: [
      // Ignore patterns from .eslintignore
      'node_modules/',
      '.next/',
      '**/.next/**',
      'public/',
      'build/',
      'out/',
      'dist/',
      '.cache/',
      '.eslintcache',
      '.docs/',
      '*.generated.*',
      '*.d.ts',
      'next.config.js',
      'postcss.config.js',
      'tailwind.config.js',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/__tests__/',
      '**/__mocks__/',
      '.tmp/',
      '.temp/',
      
      // Specific files with TypeScript 'any' issues
      'app/files/[fileId]/components/TranscriptionColumn.tsx',
      'app/files/[fileId]/ClientFileDetailsPage.tsx',
      'app/files/[fileId]/components/AISummaryTab.tsx',
      
      // Additional directories to ignore for local development
      'scripts/',
      'lib/utils/',
    ]
  },
  
  // Next.js configuration
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      next: nextPlugin,
      import: importPlugin,
      '@typescript-eslint': typescriptPlugin,
      'unused-imports': unusedImportsPlugin,
      'react-hooks': reactHooksPlugin,
      react: reactPlugin,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true
        }
      },
      react: {
        version: 'detect',
      },
    },
    rules: {
      // General rules - all relaxed
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'off',
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/rules-of-hooks': 'warn',
      'react/jsx-no-comment-textnodes': 'off',
      
      // Strict null checking rules - all disabled
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      
      // Import path rules - all relaxed
      'import/no-duplicates': 'off',
      'import/order': 'off',
      'import/no-cycle': 'off',
      'import/no-self-import': 'off'
    }
  }
]; 