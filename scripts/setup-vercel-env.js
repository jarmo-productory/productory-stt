#!/usr/bin/env node

/**
 * Script to automatically set up environment variables in Vercel
 *
 * Usage:
 * 1. Make sure you have a Vercel access token: https://vercel.com/account/tokens
 * 2. Run: VERCEL_TOKEN=your_token PROJECT_ID=your_project_id node scripts/setup-vercel-env.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.PROJECT_ID;

if (!VERCEL_TOKEN || !PROJECT_ID) {
  console.error('Error: VERCEL_TOKEN and PROJECT_ID environment variables are required');
  console.error('Get your token from: https://vercel.com/account/tokens');
  console.error('Get your project ID from the project settings page or using the Vercel CLI');
  process.exit(1);
}

// Default environment variables for Next.js on Vercel
const DEFAULT_ENV_VARS = [
  { key: 'NODE_ENV', value: 'production', target: ['production', 'preview'] },
  { key: 'NEXT_TELEMETRY_DISABLED', value: '1', target: ['production', 'preview', 'development'] },
];

// Try to load additional variables from .env file if it exists
let additionalVars = [];
const envPath = path.join(process.cwd(), '.env');
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

      // Skip if key is empty or it's one of the default vars
      if (!key || DEFAULT_ENV_VARS.some(v => v.key === key)) continue;

      additionalVars.push({
        key,
        value,
        target: ['production', 'preview', 'development'],
      });
    }
  }
}

// Combine default and additional variables
const allEnvVars = [...DEFAULT_ENV_VARS, ...additionalVars];

// Function to create environment variables via Vercel API
function createEnvVar(envVar) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      key: envVar.key,
      value: envVar.value,
      target: envVar.target,
    });

    const options = {
      hostname: 'api.vercel.com',
      path: `/v9/projects/${PROJECT_ID}/env`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, res => {
      let responseData = '';

      res.on('data', chunk => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ key: envVar.key, success: true });
        } else {
          try {
            const parsedData = JSON.parse(responseData);
            resolve({
              key: envVar.key,
              success: false,
              error: parsedData.error?.message || 'Unknown error',
            });
          } catch (e) {
            resolve({ key: envVar.key, success: false, error: responseData });
          }
        }
      });
    });

    req.on('error', error => {
      reject({ key: envVar.key, success: false, error: error.message });
    });

    req.write(data);
    req.end();
  });
}

// Main function to set up all environment variables
async function setupEnvVars() {
  console.log(`Setting up ${allEnvVars.length} environment variables for project ${PROJECT_ID}...`);

  const results = [];
  for (const envVar of allEnvVars) {
    try {
      console.log(`Setting ${envVar.key}...`);
      const result = await createEnvVar(envVar);
      results.push(result);
    } catch (error) {
      results.push({ key: envVar.key, success: false, error: error.message });
    }
  }

  // Print summary
  console.log('\nEnvironment variables setup summary:');
  const successful = results.filter(r => r.success).length;
  console.log(`✅ Successfully set up ${successful} of ${allEnvVars.length} variables`);

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`❌ Failed to set up ${failed.length} variables:`);
    failed.forEach(f => {
      console.log(`  - ${f.key}: ${f.error}`);
    });
  }
}

setupEnvVars().catch(error => {
  console.error('Error setting up environment variables:', error);
  process.exit(1);
});
