#!/usr/bin/env node

/**
 * This script helps with deploying the application to Render.
 * It validates the environment variables and configuration before deployment.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

console.log(`${colors.cyan}=== Render Deployment Helper ===${colors.reset}\n`);

// Check if render.yaml exists
const renderYamlPath = path.join(process.cwd(), 'render.yaml');
if (!fs.existsSync(renderYamlPath)) {
  console.error(
    `${colors.red}Error: render.yaml not found. Please create it first.${colors.reset}`
  );
  process.exit(1);
}

console.log(`${colors.green}✓ render.yaml found${colors.reset}`);

// Check if next.config.js has the correct configuration
const nextConfigPath = path.join(process.cwd(), 'next.config.js');
if (!fs.existsSync(nextConfigPath)) {
  console.error(`${colors.red}Error: next.config.js not found.${colors.reset}`);
  process.exit(1);
}

const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
if (!nextConfig.includes("output: 'standalone'")) {
  console.warn(
    `${colors.yellow}Warning: next.config.js does not have output: 'standalone' set.${colors.reset}`
  );
  console.warn(`${colors.yellow}This is required for deployment to Render.${colors.reset}`);
} else {
  console.log(`${colors.green}✓ next.config.js has correct output configuration${colors.reset}`);
}

// Check if .env.local exists and suggest copying variables
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log(`${colors.green}✓ .env.local found${colors.reset}`);
  console.log(
    `${colors.yellow}Remember to add these environment variables to your Render dashboard:${colors.reset}`
  );

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = envContent
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split('=')[0]);

  envVars.forEach(variable => {
    console.log(`  - ${variable}`);
  });
} else {
  console.warn(
    `${colors.yellow}Warning: .env.local not found. Make sure to set up environment variables in Render.${colors.reset}`
  );
}

// Check if package.json has the correct scripts
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error(`${colors.red}Error: package.json not found.${colors.reset}`);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
if (!packageJson.scripts.build || !packageJson.scripts.start) {
  console.error(
    `${colors.red}Error: package.json must have 'build' and 'start' scripts.${colors.reset}`
  );
  process.exit(1);
}

console.log(`${colors.green}✓ package.json has required scripts${colors.reset}`);

// Provide instructions for deployment
console.log(`\n${colors.cyan}=== Deployment Instructions ===${colors.reset}`);
console.log(`
1. Push your changes to GitHub:
   ${colors.blue}git add .${colors.reset}
   ${colors.blue}git commit -m "Configure for Render deployment"${colors.reset}
   ${colors.blue}git push${colors.reset}

2. Go to the Render dashboard and create a new Web Service:
   - Connect your GitHub repository
   - Use the settings from render.yaml
   - Add all environment variables

3. Or use Render Blueprints for automatic deployment:
   - In the Render dashboard, click "New" and select "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect the render.yaml file

For more detailed instructions, see RENDER-DEPLOYMENT.md
`);

console.log(`${colors.green}Your application is ready for deployment to Render!${colors.reset}`);
