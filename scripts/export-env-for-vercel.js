#!/usr/bin/env node

/**
 * Script to export environment variables from .env file to a format
 * that can be easily copied and pasted into Vercel's UI
 *
 * Usage:
 * node scripts/export-env-for-vercel.js
 */

const fs = require('fs');
const path = require('path');

// Default environment variables for Next.js on Vercel
const DEFAULT_ENV_VARS = {
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
};

// Try to load variables from .env file if it exists
const envPath = path.join(process.cwd(), '.env');
let allVars = { ...DEFAULT_ENV_VARS };

if (fs.existsSync(envPath)) {
  console.log('Loading variables from .env file...');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');

  for (const line of envLines) {
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();

      // Skip if key is empty
      if (!key) continue;

      allVars[key] = value;
    }
  }
}

// Format for Vercel UI
console.log('\n=== Copy and paste these variables into Vercel ===\n');
for (const [key, value] of Object.entries(allVars)) {
  console.log(`${key}=${value}`);
}

// Format for vercel.json
const vercelEnv = Object.entries(allVars).map(([key, value]) => ({
  key,
  value,
  target: ['production', 'preview', 'development'],
}));

const vercelJson = {
  env: vercelEnv,
};

// Write to vercel.json if it doesn't exist
const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
if (!fs.existsSync(vercelJsonPath)) {
  console.log('\nCreating vercel.json with environment variables...');
  fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelJson, null, 2), 'utf8');
  console.log(`✅ Created vercel.json with ${Object.keys(allVars).length} environment variables`);
} else {
  console.log('\nvercel.json already exists. Environment variables for vercel.json:');
  console.log(JSON.stringify(vercelJson, null, 2));
}

console.log('\n=== Done ===');
