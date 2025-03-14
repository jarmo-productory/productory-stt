#!/usr/bin/env node

/**
 * This script runs ESLint and counts the number of errors by type
 * to help prioritize which errors to fix first.
 */

const { execSync } = require('child_process');
const fs = require('fs');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

// Get directory to check from command line args or default to 'app'
const directoryToCheck = process.argv[2] || 'app';

console.log(
  `${colors.bold}${colors.blue}Counting ESLint errors in ${directoryToCheck}...${colors.reset}\n`
);

try {
  // Run ESLint and capture the output, focusing on a specific directory
  const eslintOutput = execSync(`npx eslint ${directoryToCheck} --format json`, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer to handle large output
  });

  // Parse the JSON output
  const eslintResults = JSON.parse(eslintOutput);

  // Count errors by rule
  const errorCounts = {};
  let totalErrors = 0;
  let totalWarnings = 0;

  eslintResults.forEach(result => {
    result.messages.forEach(message => {
      const ruleId = message.ruleId || 'unknown';
      const severity = message.severity === 2 ? 'error' : 'warning';

      if (!errorCounts[ruleId]) {
        errorCounts[ruleId] = { error: 0, warning: 0 };
      }

      errorCounts[ruleId][severity]++;

      if (severity === 'error') {
        totalErrors++;
      } else {
        totalWarnings++;
      }
    });
  });

  // Sort rules by error count (highest first)
  const sortedRules = Object.entries(errorCounts).sort((a, b) => {
    return b[1].error + b[1].warning - (a[1].error + a[1].warning);
  });

  // Display the results
  console.log(`${colors.bold}Error counts by rule:${colors.reset}\n`);

  sortedRules.forEach(([rule, counts]) => {
    const total = counts.error + counts.warning;
    const errorColor = counts.error > 0 ? colors.red : colors.reset;
    const warningColor = counts.warning > 0 ? colors.yellow : colors.reset;

    console.log(
      `${colors.cyan}${rule}${colors.reset}: ` +
        `${errorColor}${counts.error} errors${colors.reset}, ` +
        `${warningColor}${counts.warning} warnings${colors.reset} ` +
        `(${total} total)`
    );
  });

  console.log(`\n${colors.bold}Summary:${colors.reset}`);
  console.log(`${colors.red}Total errors: ${totalErrors}${colors.reset}`);
  console.log(`${colors.yellow}Total warnings: ${totalWarnings}${colors.reset}`);
  console.log(`${colors.bold}Total issues: ${totalErrors + totalWarnings}${colors.reset}`);

  // Provide recommendations
  console.log(`\n${colors.bold}${colors.green}Recommendations:${colors.reset}`);
  console.log(`1. Start by fixing the most frequent error types first.`);
  console.log(
    `2. Focus on '@typescript-eslint/no-explicit-any' errors by replacing 'any' with proper types.`
  );
  console.log(
    `3. Fix unused variables and imports with the 'unused-imports/no-unused-vars' errors.`
  );
  console.log(`4. Address React Hook dependency issues to prevent potential bugs.`);
  console.log(`\nTo check a different directory, run: npm run count-errors -- <directory>`);
} catch (error) {
  console.error(`${colors.red}Error running ESLint:${colors.reset}`, error.message);
  process.exit(1);
}
