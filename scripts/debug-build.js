#!/usr/bin/env node

/**
 * This script helps debug the build process by adding more verbose output
 * and checking for common issues that might cause build failures.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Build Debug Information ===');

// Check Node.js version
console.log(`\nNode.js version: ${process.version}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Platform: ${process.platform}`);

// Check for .next directory
const nextDir = path.join(process.cwd(), '.next');
if (fs.existsSync(nextDir)) {
  console.log('\n.next directory exists');

  // Check for key build files
  const serverDir = path.join(nextDir, 'server');
  if (fs.existsSync(serverDir)) {
    console.log('  ✅ .next/server directory exists');
  } else {
    console.log('  ❌ .next/server directory is missing');
  }

  const staticDir = path.join(nextDir, 'static');
  if (fs.existsSync(staticDir)) {
    console.log('  ✅ .next/static directory exists');
  } else {
    console.log('  ❌ .next/static directory is missing');
  }
} else {
  console.log('\n❌ .next directory does not exist - build may have failed');
}

// Check for standalone output (since output: 'standalone' is set in next.config.js)
const standaloneDir = path.join(process.cwd(), '.next/standalone');
if (fs.existsSync(standaloneDir)) {
  console.log('\n✅ .next/standalone directory exists (output: standalone is working)');
} else {
  console.log('\n❌ .next/standalone directory is missing - standalone output may have failed');
}

// Check disk space
try {
  console.log('\nDisk space information:');
  const diskSpace = execSync('df -h').toString();
  console.log(diskSpace);
} catch (error) {
  console.log('Could not check disk space:', error.message);
}

// Check memory usage
try {
  console.log('\nMemory usage:');
  const memoryUsage = execSync('free -h').toString();
  console.log(memoryUsage);
} catch (error) {
  console.log('Could not check memory usage:', error.message);
}

// Check for common environment variables
console.log('\nChecking environment variables:');
const requiredEnvVars = ['NODE_ENV', 'NODE_VERSION', 'NEXT_TELEMETRY_DISABLED', 'NEXT_SHARP_PATH'];

for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`  ✅ ${envVar} is set to: ${process.env[envVar]}`);
  } else {
    console.log(`  ❌ ${envVar} is not set`);
  }
}

// Check package.json scripts
try {
  const packageJson = require(path.join(process.cwd(), 'package.json'));
  console.log('\nPackage.json scripts:');
  console.log(packageJson.scripts);

  console.log('\nDependencies:');
  console.log('  Total dependencies:', Object.keys(packageJson.dependencies || {}).length);
  console.log('  Total devDependencies:', Object.keys(packageJson.devDependencies || {}).length);
} catch (error) {
  console.log('Could not read package.json:', error.message);
}

console.log('\n=== End of Debug Information ===');
