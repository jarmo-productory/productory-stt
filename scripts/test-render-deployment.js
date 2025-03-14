#!/usr/bin/env node

/**
 * This script tests that the application is running correctly on Render.
 * It makes HTTP requests to key endpoints and verifies that they return the expected responses.
 */

const https = require('https');
const readline = require('readline');

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

console.log(`${colors.cyan}=== Render Deployment Test ===${colors.reset}\n`);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Ask for the Render URL
rl.question(
  `${colors.yellow}Enter your Render URL (e.g., https://productory-stt.onrender.com): ${colors.reset}`,
  renderUrl => {
    // Remove trailing slash if present
    renderUrl = renderUrl.endsWith('/') ? renderUrl.slice(0, -1) : renderUrl;

    console.log(`\n${colors.blue}Testing deployment at ${renderUrl}...${colors.reset}\n`);

    // Define endpoints to test
    const endpoints = [
      { path: '/', name: 'Home page', expectedStatus: 200 },
      { path: '/favicon.ico', name: 'Favicon', expectedStatus: 200 },
      { path: '/_next/static/', name: 'Static assets', expectedStatus: 200 },
      { path: '/api/health', name: 'Health check API', expectedStatus: 200 },
      { path: '/non-existent-page', name: '404 page', expectedStatus: 404 },
    ];

    // Test each endpoint
    let completedTests = 0;
    let passedTests = 0;

    endpoints.forEach(endpoint => {
      testEndpoint(renderUrl, endpoint, success => {
        completedTests++;
        if (success) passedTests++;

        // Check if all tests are complete
        if (completedTests === endpoints.length) {
          console.log(`\n${colors.cyan}=== Test Results ===${colors.reset}`);
          console.log(`${colors.blue}Total tests: ${colors.reset}${endpoints.length}`);
          console.log(`${colors.green}Passed: ${colors.reset}${passedTests}`);
          console.log(`${colors.red}Failed: ${colors.reset}${endpoints.length - passedTests}`);

          if (passedTests === endpoints.length) {
            console.log(
              `\n${colors.green}All tests passed! Your deployment appears to be working correctly.${colors.reset}`
            );
          } else {
            console.log(
              `\n${colors.yellow}Some tests failed. Please check the logs for more information.${colors.reset}`
            );
          }

          rl.close();
        }
      });
    });
  }
);

// Function to test an endpoint
function testEndpoint(baseUrl, endpoint, callback) {
  const url = `${baseUrl}${endpoint.path}`;

  console.log(`${colors.blue}Testing ${endpoint.name} (${url})...${colors.reset}`);

  https
    .get(url, res => {
      const { statusCode } = res;

      if (statusCode === endpoint.expectedStatus) {
        console.log(
          `${colors.green}✓ ${endpoint.name}: Status ${statusCode} (Expected: ${endpoint.expectedStatus})${colors.reset}`
        );
        callback(true);
      } else {
        console.log(
          `${colors.red}✗ ${endpoint.name}: Status ${statusCode} (Expected: ${endpoint.expectedStatus})${colors.reset}`
        );
        callback(false);
      }
    })
    .on('error', err => {
      console.log(`${colors.red}✗ ${endpoint.name}: Error - ${err.message}${colors.reset}`);
      callback(false);
    });
}
