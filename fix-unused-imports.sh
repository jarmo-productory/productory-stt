#!/bin/bash

# Script to automatically fix unused imports and variables using ESLint

echo "🧹 Cleaning up unused imports and variables..."

# Run ESLint with --fix option on TypeScript files
npx eslint --fix "app/**/*.{ts,tsx}" "components/**/*.{ts,tsx}" "contexts/**/*.{ts,tsx}" "hooks/**/*.{ts,tsx}" "lib/**/*.{ts,tsx}" "middleware.ts" "tailwind.config.ts"

echo "✅ Cleanup complete!" 