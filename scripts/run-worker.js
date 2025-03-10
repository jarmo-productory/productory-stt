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

// Add this at the beginning of the file, after the imports
const DEBUG = process.argv.includes('--debug');

function debugLog(...args) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
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
  
  // Poll for jobs at regular intervals
  const intervalId = setInterval(async () => {
    try {
      // Call the worker API in batch mode
      const response = await fetch(`${API_URL}/api/jobs/worker`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WORKER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ maxJobs: MAX_JOBS, mode: 'batch' })
      });
      
      if (!response.ok) {
        console.error(`Error from worker API: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      
      if (data.message === 'No pending jobs found') {
        console.log('No pending jobs found');
        return;
      }
      
      if (data.mode === 'batch' && data.jobs && data.jobs.length > 0) {
        console.log(`Found ${data.jobs.length} pending jobs`);
        
        // Process each job individually
        for (const job of data.jobs) {
          console.log(`Processing job ${job.id} (${job.type})...`);
          
          // Update job status to processing
          await fetch(`${API_URL}/api/jobs/update`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${WORKER_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ jobId: job.id, status: 'processing' })
          });
          
          // Call the worker API to process the job
          const jobResponse = await fetch(`${API_URL}/api/jobs/worker`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${WORKER_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ maxJobs: 1, mode: 'single', jobId: job.id })
          });
          
          if (!jobResponse.ok) {
            console.error(`Error processing job ${job.id}: ${jobResponse.status} ${jobResponse.statusText}`);
            
            // Update job status to failed
            await fetch(`${API_URL}/api/jobs/update`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${WORKER_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ jobId: job.id, status: 'failed' })
            });
            
            continue;
          }
          
          const jobData = await jobResponse.json();
          console.log(`Job ${job.id} processed:`, jobData);
        }
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
    const response = await fetch(`${API_URL}/api/jobs/worker`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ maxJobs: MAX_JOBS, mode: 'single' })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from worker API: ${response.status} ${response.statusText}`);
      console.error('Error details:', errorText);
      process.exit(1);
    }
    
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
  try {
    console.log('Testing worker API...');
    console.log('API URL:', API_URL);
    console.log('Worker API Key:', WORKER_API_KEY.substring(0, 4) + '****' + WORKER_API_KEY.substring(WORKER_API_KEY.length - 4));
    
    const response = await fetch(`${API_URL}/api/jobs/worker`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ maxJobs: 1, mode: 'single' })
    });
    
    debugLog('API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API is not reachable: ${response.status} ${response.statusText}`);
      console.error('Error details:', errorText);
      return false;
    }
    
    console.log('API response status:', response.status);
    console.log('API is reachable!');
    return true;
  } catch (error) {
    console.error('Error testing worker API:', error);
    return false;
  }
}

// Find the processJobs function and update it
async function processJobs(mode = 'continuous', maxJobs = 10) {
  try {
    console.log(`Processing jobs in mode: ${mode}, maxJobs: ${maxJobs}`);
    
    // Call the worker API to process jobs
    const response = await fetch(`${API_URL}/api/jobs/worker`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ maxJobs, mode: mode === 'continuous' ? 'batch' : 'single' })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error processing jobs: ${response.status} ${response.statusText}`);
      console.error('Error details:', errorText);
      return { error: `API error: ${response.status} ${response.statusText}` };
    }
    
    const data = await response.json();
    
    return data;
  } catch (error) {
    console.error('Error processing jobs:', error);
    return { error: error.message || 'Unknown error' };
  }
}

// Run the worker
runWorker(); 