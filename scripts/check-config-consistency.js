#!/usr/bin/env node

/**
 * This script checks if your local ESLint and TypeScript configurations
 * match those expected in the CI/CD pipeline.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

console.log(
  `${colors.bold}${colors.blue}Checking configuration consistency with CI/CD pipeline...${colors.reset}\n`
);

// Expected settings that should be enabled in tsconfig.json
const expectedTsSettings = {
  strict: true,
  noImplicitAny: true,
  strictNullChecks: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
};

// Expected rules that should be enabled in .eslintrc.json
const expectedEslintRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  'unused-imports/no-unused-imports': 'error',
};

// Check TypeScript configuration
console.log(`${colors.cyan}Checking TypeScript configuration...${colors.reset}`);
try {
  const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
  const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));

  let tsConfigValid = true;
  for (const [setting, expectedValue] of Object.entries(expectedTsSettings)) {
    const actualValue = tsConfig.compilerOptions[setting];
    const isValid = actualValue === expectedValue;

    console.log(
      `${isValid ? colors.green + '✓' : colors.red + '✗'} ${colors.reset}` +
        `${setting}: ${isValid ? 'correctly set to' : 'should be'} ${expectedValue}, ` +
        `${isValid ? 'as expected' : `but is ${actualValue}`}`
    );

    if (!isValid) {
      tsConfigValid = false;
    }
  }

  if (tsConfigValid) {
    console.log(`\n${colors.green}TypeScript configuration looks good!${colors.reset}`);
  } else {
    console.log(
      `\n${colors.yellow}TypeScript configuration has issues that might cause CI/CD failures.${colors.reset}`
    );
  }
} catch (error) {
  console.error(
    `${colors.red}Error checking TypeScript configuration:${colors.reset}`,
    error.message
  );
}

// Check ESLint configuration
console.log(`\n${colors.cyan}Checking ESLint configuration...${colors.reset}`);
try {
  // Try to find the ESLint config file (either .eslintrc.json or .eslintrc.js)
  let eslintConfig;
  let configPath;

  const jsonConfigPath = path.join(process.cwd(), '.eslintrc.json');
  const jsConfigPath = path.join(process.cwd(), '.eslintrc.js');

  if (fs.existsSync(jsConfigPath)) {
    configPath = jsConfigPath;
    // For JS config files, we need to require them
    eslintConfig = require(jsConfigPath);
    console.log(`${colors.cyan}Using .eslintrc.js configuration file${colors.reset}`);
  } else if (fs.existsSync(jsonConfigPath)) {
    configPath = jsonConfigPath;
    try {
      // Try to parse the ESLint JSON config file
      const fileContent = fs.readFileSync(jsonConfigPath, 'utf8');
      eslintConfig = JSON.parse(fileContent);
      console.log(`${colors.cyan}Using .eslintrc.json configuration file${colors.reset}`);
    } catch (parseError) {
      console.error(
        `${colors.red}Error parsing ESLint configuration:${colors.reset}`,
        parseError.message
      );
      console.log(
        `${colors.yellow}Your .eslintrc.json file may contain comments or trailing commas which are not valid JSON.${colors.reset}`
      );
      console.log(
        `${colors.yellow}Consider using .eslintrc.js instead for more flexibility.${colors.reset}`
      );
      return;
    }
  } else {
    console.error(`${colors.red}No ESLint configuration file found.${colors.reset}`);
    return;
  }

  let eslintConfigValid = true;
  for (const [rule, expectedValue] of Object.entries(expectedEslintRules)) {
    const actualValue = eslintConfig.rules?.[rule];
    const isValid = JSON.stringify(actualValue) === JSON.stringify(expectedValue);

    console.log(
      `${isValid ? colors.green + '✓' : colors.red + '✗'} ${colors.reset}` +
        `${rule}: ${isValid ? 'correctly set to' : 'should be'} ${JSON.stringify(expectedValue)}, ` +
        `${isValid ? 'as expected' : `but is ${JSON.stringify(actualValue)}`}`
    );

    if (!isValid) {
      eslintConfigValid = false;
    }
  }

  if (eslintConfigValid) {
    console.log(`\n${colors.green}ESLint configuration looks good!${colors.reset}`);
  } else {
    console.log(
      `\n${colors.yellow}ESLint configuration has issues that might cause CI/CD failures.${colors.reset}`
    );
  }
} catch (error) {
  console.error(`${colors.red}Error checking ESLint configuration:${colors.reset}`, error.message);
}

// Check if the pre-commit and pre-push hooks are properly set up
console.log(`\n${colors.cyan}Checking Git hooks...${colors.reset}`);
try {
  const preCommitPath = path.join(process.cwd(), '.husky', 'pre-commit');
  const prePushPath = path.join(process.cwd(), '.husky', 'pre-push');

  const preCommitExists = fs.existsSync(preCommitPath);
  const prePushExists = fs.existsSync(prePushPath);

  console.log(
    `${preCommitExists ? colors.green + '✓' : colors.red + '✗'} ${colors.reset}` +
      `pre-commit hook: ${preCommitExists ? 'exists' : 'missing'}`
  );

  console.log(
    `${prePushExists ? colors.green + '✓' : colors.red + '✗'} ${colors.reset}` +
      `pre-push hook: ${prePushExists ? 'exists' : 'missing'}`
  );

  if (preCommitExists && prePushExists) {
    console.log(`\n${colors.green}Git hooks are properly set up!${colors.reset}`);
  } else {
    console.log(
      `\n${colors.yellow}Some Git hooks are missing. Run 'npm run prepare' to set them up.${colors.reset}`
    );
  }
} catch (error) {
  console.error(`${colors.red}Error checking Git hooks:${colors.reset}`, error.message);
}

console.log(`\n${colors.bold}${colors.blue}Configuration check complete!${colors.reset}`);
