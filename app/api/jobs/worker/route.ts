import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processTranscriptionJob } from '@/lib/jobs/transcription';

/**
 * POST /api/jobs/worker
 * Starts the worker process to handle background jobs
 * This endpoint should be called by a scheduled task or cron job
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Worker API] Received request');
    
    // Verify the worker API key
    if (!verifyWorkerApiKey(request)) {
      console.error('[Worker API] Invalid API key');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse the request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('[Worker API] Error parsing request body:', error);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const maxJobs = body.maxJobs || 10;
    const mode = body.mode || 'batch';
    const specificJobId = body.jobId; // Optional: process a specific job
    
    console.log(`[Worker API] Processing jobs: maxJobs=${maxJobs}, mode=${mode}, specificJobId=${specificJobId || 'none'}`);
    
    // Create a Supabase client with service role credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[Worker API] Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get pending jobs from the job queue
    console.log('[Worker API] Fetching pending jobs');
    
    let query = supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    
    // If a specific job ID is provided, filter by that
    if (specificJobId) {
      query = query.eq('id', specificJobId);
    }
    
    // Limit the number of jobs
    query = query.limit(maxJobs);
    
    const { data: jobs, error: jobsError } = await query;
    
    if (jobsError) {
      console.error('[Worker API] Error fetching jobs:', jobsError);
      return NextResponse.json(
        { error: 'Failed to fetch jobs', details: jobsError.message },
        { status: 500 }
      );
    }
    
    console.log(`[Worker API] Found ${jobs?.length || 0} pending jobs`);
    
    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ message: 'No pending jobs found' });
    }
    
    // Process jobs based on mode
    if (mode === 'single') {
      // Process only the first job
      const job = jobs[0];
      console.log(`[Worker API] Processing single job: ${job.id} (${job.job_type})`);
      
      try {
        // Update job status to processing
        const { error: updateError } = await supabase
          .from('job_queue')
          .update({
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', job.id);
        
        if (updateError) {
          console.error(`[Worker API] Error updating job status: ${updateError.message}`);
          throw new Error(`Failed to update job status: ${updateError.message}`);
        }
        
        // Process the job based on its type
        let result;
        if (job.job_type === 'transcription') {
          console.log(`[Worker API] Processing transcription job: ${job.id}`);
          const { processTranscriptionJob } = await import('@/lib/jobs/transcription');
          result = await processTranscriptionJob(job, supabase);
        } else {
          throw new Error(`Unsupported job type: ${job.job_type}`);
        }
        
        // Update job status to completed
        const { error: completeError } = await supabase
          .from('job_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result
          })
          .eq('id', job.id);
        
        if (completeError) {
          console.error(`[Worker API] Error completing job: ${completeError.message}`);
          throw new Error(`Failed to complete job: ${completeError.message}`);
        }
        
        console.log(`[Worker API] Job ${job.id} completed successfully`);
        
        return NextResponse.json({
          mode: 'single',
          processed: 1,
          results: [
            {
              jobId: job.id,
              type: job.job_type,
              status: 'completed',
              success: true
            }
          ]
        });
      } catch (error) {
        console.error(`[Worker API] Error processing job ${job.id}:`, error);
        
        // Update job status to failed
        try {
          const { error: failError } = await supabase
            .from('job_queue')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              result: {
                error: error instanceof Error ? error.message : String(error),
                success: false
              }
            })
            .eq('id', job.id);
          
          if (failError) {
            console.error(`[Worker API] Error updating failed job: ${failError.message}`);
          }
        } catch (updateError) {
          console.error(`[Worker API] Error updating job status to failed: ${updateError}`);
        }
        
        return NextResponse.json({
          mode: 'single',
          processed: 1,
          results: [
            {
              jobId: job.id,
              type: job.job_type,
              status: 'failed',
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }
          ]
        });
      }
    } else {
      // Batch mode - return job IDs for the worker to process
      return NextResponse.json({
        mode: 'batch',
        jobs: jobs.map(job => ({
          id: job.id,
          type: job.job_type
        }))
      });
    }
  } catch (error) {
    console.error('[Worker API] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Verify worker API key
function verifyWorkerApiKey(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  console.log('Auth header:', authHeader ? 'Present' : 'Missing');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Invalid auth header format');
    return false;
  }
  
  const apiKey = authHeader.split(' ')[1];
  const expectedKey = process.env.WORKER_API_KEY;
  console.log('API key check:', apiKey ? 'Present' : 'Missing', 'Expected key:', expectedKey ? 'Present' : 'Missing');
  console.log('API key match:', apiKey === expectedKey);
  
  return apiKey === expectedKey;
} 