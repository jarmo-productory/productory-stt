// ESLint Flat Config
// This replaces the old .eslintrc.js configuration

import nextPlugin from '@next/eslint-plugin-next';
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
    ]
  },
  
  // Next.js configuration
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
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
      // General rules
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        { 
          vars: 'all', 
          varsIgnorePattern: '^_', 
          args: 'after-used', 
          argsIgnorePattern: '^_' 
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react/jsx-no-comment-textnodes': 'warn',
      
      // Strict null checking rules
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true
      }],
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      
      // Import path rules
      'import/no-duplicates': 'warn',
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [
            {
              pattern: 'react',
              group: 'builtin',
              position: 'before'
            },
            {
              pattern: 'next/**',
              group: 'builtin',
              position: 'before'
            },
            {
              pattern: '@/components/ui/**',
              group: 'internal',
              position: 'before'
            },
            {
              pattern: '@/app/components/**',
              group: 'internal',
              position: 'after'
            }
          ],
          pathGroupsExcludedImportTypes: ['react'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true
          }
        }
      ],
      'import/no-cycle': 'warn',
      'import/no-self-import': 'warn'
    }
  }
]; 