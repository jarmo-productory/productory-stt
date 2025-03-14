#!/usr/bin/env node

/**
 * This script checks if path aliases are correctly configured
 * It's meant to be run during the build process to verify configuration
 */

const fs = require('fs');
const path = require('path');

console.log('Checking path alias configuration...');

// Check if tsconfig.json exists and has correct path aliases
const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
  try {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
    if (
      tsconfig.compilerOptions &&
      tsconfig.compilerOptions.paths &&
      tsconfig.compilerOptions.paths['@/*']
    ) {
      console.log('✅ tsconfig.json has correct path aliases configuration');
    } else {
      console.warn('⚠️ tsconfig.json does not have correct path aliases configuration');
    }
  } catch (error) {
    console.error('❌ Error parsing tsconfig.json:', error.message);
  }
} else {
  console.warn('⚠️ tsconfig.json not found');
}

// Check if jsconfig.json exists and has correct path aliases
const jsconfigPath = path.join(process.cwd(), 'jsconfig.json');
if (fs.existsSync(jsconfigPath)) {
  try {
    const jsconfig = JSON.parse(fs.readFileSync(jsconfigPath, 'utf8'));
    if (
      jsconfig.compilerOptions &&
      jsconfig.compilerOptions.paths &&
      jsconfig.compilerOptions.paths['@/*']
    ) {
      console.log('✅ jsconfig.json has correct path aliases configuration');
    } else {
      console.warn('⚠️ jsconfig.json does not have correct path aliases configuration');
    }
  } catch (error) {
    console.error('❌ Error parsing jsconfig.json:', error.message);
  }
} else {
  console.warn('⚠️ jsconfig.json not found');
}

// Check if next.config.js exists
const nextConfigPath = path.join(process.cwd(), 'next.config.js');
if (fs.existsSync(nextConfigPath)) {
  console.log('✅ next.config.js exists');
} else {
  console.warn('⚠️ next.config.js not found');
}

console.log('Path alias check completed');
