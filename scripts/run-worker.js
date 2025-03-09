#!/usr/bin/env node

/**
 * Job Queue Worker Script
 * 
 * This script runs the worker process to handle background jobs.
 * It can be run as a standalone process or as a cron job.
 * 
 * Usage:
 *   node scripts/run-worker.js [options]
 * 
 * Options:
 *   --max-jobs <number>     Maximum number of jobs to process (default: 10)
 *   --poll-interval <ms>    Interval in milliseconds to poll for new jobs (default: 5000)
 *   --continuous            Run in continuous mode (keep running until stopped)
 *   --single-run            Process a single batch of jobs and exit (default)
 */

// Load environment variables
// require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
// const fetch = require('node-fetch');

// Handle node-fetch import for different Node.js versions
let fetch;
try {
  // For Node.js 18+ which has built-in fetch
  if (globalThis.fetch) {
    fetch = globalThis.fetch;
    console.log('Using built-in fetch');
  } else {
    // For older Node.js versions
    fetch = require('node-fetch');
    console.log('Using node-fetch package');
  }
} catch (error) {
  console.error('Error importing fetch:', error);
  process.exit(1);
}

// Configuration
const MAX_JOBS = parseInt(getArgValue('--max-jobs') || '10', 10);
const POLL_INTERVAL = parseInt(getArgValue('--poll-interval') || '5000', 10);
const CONTINUOUS = hasArg('--continuous');
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const WORKER_API_KEY = process.env.WORKER_API_KEY;

if (!WORKER_API_KEY) {
  console.error('Error: WORKER_API_KEY environment variable is not set');
  process.exit(1);
}

/**
 * Main function to run the worker
 */
async function runWorker() {
  console.log('Starting worker process...');
  console.log(`Mode: ${CONTINUOUS ? 'Continuous' : 'Single run'}`);
  console.log(`Max jobs per batch: ${MAX_JOBS}`);
  
  // Test the API connection first
  await testWorkerAPI();
  
  if (CONTINUOUS) {
    console.log(`Poll interval: ${POLL_INTERVAL}ms`);
    await runContinuous();
  } else {
    await runSingleBatch();
  }
}

/**
 * Run the worker in continuous mode
 */
async function runContinuous() {
  console.log('Starting worker in continuous mode...');
  
  // Set up polling interval
  const intervalId = setInterval(async () => {
    try {
      console.log(`[${new Date().toISOString()}] Polling for jobs...`);
      
      // Call the worker API
      const response = await fetch(`${API_URL}/api/jobs/worker?maxJobs=${MAX_JOBS}&mode=single`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WORKER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`Error from worker API: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      console.log(`Processed ${data.processed || 0} jobs`);
      
      if (data.results && data.results.length > 0) {
        console.log('Job results:', data.results);
      } else {
        console.log('No jobs processed in this batch');
      }
    } catch (error) {
      console.error('Error polling for jobs:', error);
    }
  }, POLL_INTERVAL);
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Worker process terminated by user');
    clearInterval(intervalId);
    process.exit(0);
  });
  
  console.log(`Worker started in continuous mode. Polling every ${POLL_INTERVAL}ms. Press Ctrl+C to stop.`);
}

/**
 * Run the worker for a single batch of jobs
 */
async function runSingleBatch() {
  try {
    // Call the worker API in single run mode
    const response = await fetch(`${API_URL}/api/jobs/worker?maxJobs=${MAX_JOBS}&mode=single`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Worker completed single run:', data);
    process.exit(0);
  } catch (error) {
    console.error('Error running worker:', error);
    process.exit(1);
  }
}

/**
 * Helper function to get command line argument value
 */
function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    return null;
  }
  return process.argv[index + 1];
}

/**
 * Helper function to check if an argument is present
 */
function hasArg(name) {
  return process.argv.includes(name);
}

/**
 * Simple test function to verify the worker API is working
 */
async function testWorkerAPI() {
  console.log('Testing worker API...');
  console.log(`API URL: ${API_URL}`);
  console.log(`Worker API Key: ${WORKER_API_KEY ? '****' + WORKER_API_KEY.slice(-4) : 'Not set'}`);
  
  try {
    // Make a simple GET request to the API to check if it's reachable
    const response = await fetch(`${API_URL}/api`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`API response status: ${response.status}`);
    
    if (response.ok) {
      console.log('API is reachable!');
    } else {
      console.log('API returned an error status code');
    }
  } catch (error) {
    console.error('Error connecting to API:', error);
  }
}

// Run the worker
runWorker(); 