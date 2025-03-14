#!/usr/bin/env node

/**
 * This script runs after the build to prepare the standalone output for deployment.
 * It copies necessary files to the standalone directory.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Running Post-Build Script ===');

// Check if .next/standalone exists
const standaloneDir = path.join(process.cwd(), '.next/standalone');
if (!fs.existsSync(standaloneDir)) {
  console.error('Error: .next/standalone directory does not exist. Build may have failed.');
  process.exit(1);
}

// Copy public directory to standalone
try {
  console.log('Copying public directory to standalone...');
  execSync('cp -R public .next/standalone/');
  console.log('✅ Public directory copied successfully');
} catch (error) {
  console.error('Error copying public directory:', error.message);
}

// Copy .next/static to standalone/.next/static
try {
  console.log('Copying .next/static to standalone/.next/static...');
  execSync('mkdir -p .next/standalone/.next/static');
  execSync('cp -R .next/static .next/standalone/.next/');
  console.log('✅ Static files copied successfully');
} catch (error) {
  console.error('Error copying static files:', error.message);
}

// Create a simple health check endpoint
const healthCheckPath = path.join(standaloneDir, 'pages', 'api');
if (!fs.existsSync(healthCheckPath)) {
  try {
    console.log('Creating health check API endpoint...');
    execSync(`mkdir -p ${healthCheckPath}`);

    const healthCheckContent = `
export default function handler(req, res) {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
`;

    fs.writeFileSync(path.join(healthCheckPath, 'health.js'), healthCheckContent);
    console.log('✅ Health check API endpoint created');
  } catch (error) {
    console.error('Error creating health check endpoint:', error.message);
  }
}

console.log('=== Post-Build Script Completed ===');
