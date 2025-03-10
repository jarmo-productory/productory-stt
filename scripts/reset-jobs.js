#!/usr/bin/env node

/**
 * Job Queue Reset Script
 * 
 * This script resets job statuses in the job queue.
 * It can reset jobs by ID, status, or job type.
 * 
 * Usage:
 *   node scripts/reset-jobs.js [options]
 * 
 * Options:
 *   --job-id <id>           Reset a specific job by ID
 *   --status <status>       Reset jobs with a specific status (e.g., 'processing', 'failed')
 *   --job-type <type>       Reset jobs of a specific type (e.g., 'transcription')
 *   --all                   Reset all jobs (use with caution)
 *   --target-status <status> Set the target status (default: 'pending')
 *   --dry-run               Show what would be reset without making changes
 *   --verbose               Show detailed output
 *   --help                  Show help
 * 
 * Examples:
 *   node scripts/reset-jobs.js --job-id 123e4567-e89b-12d3-a456-426614174000
 *   node scripts/reset-jobs.js --status processing
 *   node scripts/reset-jobs.js --job-type transcription --status failed
 *   node scripts/reset-jobs.js --all --dry-run
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

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

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  jobId: getArgValue('--job-id'),
  status: getArgValue('--status'),
  jobType: getArgValue('--job-type'),
  all: hasArg('--all'),
  targetStatus: getArgValue('--target-status') || 'pending',
  dryRun: hasArg('--dry-run'),
  verbose: hasArg('--verbose'),
  help: hasArg('--help')
};

// Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const WORKER_API_KEY = process.env.WORKER_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!WORKER_API_KEY) {
  console.error('Error: WORKER_API_KEY environment variable is not set');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  process.exit(1);
}

// Show help if requested or if no options provided
if (options.help || (!options.jobId && !options.status && !options.jobType && !options.all)) {
  showHelp();
  process.exit(0);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Main function
async function main() {
  try {
    console.log('Job Queue Reset Script');
    console.log('======================');
    
    if (options.dryRun) {
      console.log('DRY RUN MODE: No changes will be made');
    }
    
    // Build the query
    let query = supabase.from('job_queue').select('*');
    
    // Apply filters
    if (options.jobId) {
      query = query.eq('id', options.jobId);
      console.log(`Filtering by job ID: ${options.jobId}`);
    }
    
    if (options.status) {
      query = query.eq('status', options.status);
      console.log(`Filtering by status: ${options.status}`);
    }
    
    if (options.jobType) {
      query = query.eq('job_type', options.jobType);
      console.log(`Filtering by job type: ${options.jobType}`);
    }
    
    // Execute the query
    const { data: jobs, error } = await query;
    
    if (error) {
      console.error('Error fetching jobs:', error);
      process.exit(1);
    }
    
    if (!jobs || jobs.length === 0) {
      console.log('No jobs found matching the criteria');
      process.exit(0);
    }
    
    console.log(`Found ${jobs.length} jobs matching the criteria`);
    
    if (options.verbose) {
      console.log('\nJobs to reset:');
      jobs.forEach(job => {
        console.log(`- ID: ${job.id}, Type: ${job.job_type}, Status: ${job.status}, Created: ${job.created_at}`);
      });
    }
    
    // Confirm if not in dry run mode and not resetting a single job
    if (!options.dryRun && !options.jobId && jobs.length > 1) {
      const confirmation = await promptForConfirmation(`Are you sure you want to reset ${jobs.length} jobs to '${options.targetStatus}' status? (y/n): `);
      
      if (!confirmation) {
        console.log('Operation cancelled');
        process.exit(0);
      }
    }
    
    // Reset jobs
    if (!options.dryRun) {
      console.log(`\nResetting ${jobs.length} jobs to '${options.targetStatus}' status...`);
      
      const resetPromises = jobs.map(async (job) => {
        try {
          // Reset the job status
          const { error: resetError } = await supabase
            .from('job_queue')
            .update({
              status: options.targetStatus,
              started_at: null,
              completed_at: null,
              error_message: `Job reset manually at ${new Date().toISOString()}`
            })
            .eq('id', job.id);
          
          if (resetError) {
            console.error(`Error resetting job ${job.id}:`, resetError);
            return { success: false, id: job.id, error: resetError };
          }
          
          // If it's a transcription job, also reset the transcription status
          if (job.job_type === 'transcription' && job.payload && job.payload.transcription_id) {
            const transcriptionId = job.payload.transcription_id;
            
            // Reset the transcription to the target status
            const { error: transcriptionError } = await supabase
              .from('transcriptions')
              .update({
                status: options.targetStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', transcriptionId);
            
            if (transcriptionError) {
              console.error(`Error resetting transcription ${transcriptionId}:`, transcriptionError);
              return { 
                success: false, 
                id: job.id, 
                transcriptionId, 
                error: transcriptionError 
              };
            }
            
            if (options.verbose) {
              console.log(`Reset transcription ${transcriptionId} to '${options.targetStatus}'`);
            }
          }
          
          if (options.verbose) {
            console.log(`Reset job ${job.id} to '${options.targetStatus}'`);
          }
          
          return { success: true, id: job.id };
        } catch (error) {
          console.error(`Unexpected error resetting job ${job.id}:`, error);
          return { success: false, id: job.id, error };
        }
      });
      
      const results = await Promise.all(resetPromises);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      console.log(`\nReset complete: ${successCount} succeeded, ${failCount} failed`);
      
      if (failCount > 0 && options.verbose) {
        console.log('\nFailed jobs:');
        results.filter(r => !r.success).forEach(result => {
          console.log(`- ID: ${result.id}, Error: ${result.error?.message || 'Unknown error'}`);
        });
      }
    } else {
      console.log(`\nDRY RUN: Would reset ${jobs.length} jobs to '${options.targetStatus}' status`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Helper function to get argument value
function getArgValue(name) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) {
    return null;
  }
  return args[index + 1];
}

// Helper function to check if argument exists
function hasArg(name) {
  return args.includes(name);
}

// Helper function to show help
function showHelp() {
  console.log(`
Job Queue Reset Script

Usage:
  node scripts/reset-jobs.js [options]

Options:
  --job-id <id>           Reset a specific job by ID
  --status <status>       Reset jobs with a specific status (e.g., 'processing', 'failed')
  --job-type <type>       Reset jobs of a specific type (e.g., 'transcription')
  --all                   Reset all jobs (use with caution)
  --target-status <status> Set the target status (default: 'pending')
  --dry-run               Show what would be reset without making changes
  --verbose               Show detailed output
  --help                  Show help

Examples:
  node scripts/reset-jobs.js --job-id 123e4567-e89b-12d3-a456-426614174000
  node scripts/reset-jobs.js --status processing
  node scripts/reset-jobs.js --job-type transcription --status failed
  node scripts/reset-jobs.js --all --dry-run
  `);
}

// Helper function to prompt for confirmation
async function promptForConfirmation(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    readline.question(question, answer => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 