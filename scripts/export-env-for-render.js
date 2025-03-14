#!/usr/bin/env node

/**
 * This script exports environment variables from .env.local to a format
 * that can be easily imported into Render.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

console.log(`${colors.cyan}=== Export Environment Variables for Render ===${colors.reset}\n`);

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error(`${colors.red}Error: .env.local not found.${colors.reset}`);
  process.exit(1);
}

// Read .env.local
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = envContent
  .split('\n')
  .filter(line => line.trim() && !line.startsWith('#'))
  .map(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('='); // Handle values that contain = character
    return { key: key.trim(), value: value.trim() };
  });

// Create output directory if it doesn't exist
const outputDir = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Write to JSON file
const jsonOutput = path.join(outputDir, 'render-env-vars.json');
fs.writeFileSync(jsonOutput, JSON.stringify(envVars, null, 2));

// Write to CSV file
const csvOutput = path.join(outputDir, 'render-env-vars.csv');
const csvContent =
  'key,value\n' + envVars.map(({ key, value }) => `"${key}","${value}"`).join('\n');
fs.writeFileSync(csvOutput, csvContent);

// Write to .env file
const envOutput = path.join(outputDir, 'render.env');
const envFileContent = envVars.map(({ key, value }) => `${key}=${value}`).join('\n');
fs.writeFileSync(envOutput, envFileContent);

console.log(`${colors.green}Environment variables exported to:${colors.reset}`);
console.log(`- JSON: ${colors.blue}${jsonOutput}${colors.reset}`);
console.log(`- CSV: ${colors.blue}${csvOutput}${colors.reset}`);
console.log(`- ENV: ${colors.blue}${envOutput}${colors.reset}`);

console.log(`\n${colors.yellow}Instructions:${colors.reset}`);
console.log(`1. For JSON format: In Render dashboard, go to Environment > Bulk Import > JSON`);
console.log(`2. For CSV format: In Render dashboard, go to Environment > Bulk Import > CSV`);
console.log(`3. For manual import: Copy values from ${colors.blue}${envOutput}${colors.reset}`);

console.log(`\n${colors.green}Done!${colors.reset}`);
