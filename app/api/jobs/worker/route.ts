import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { processTranscriptionJob } from '@/lib/jobs/transcription';

const WORKER_API_KEY = process.env.WORKER_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate worker authentication
function validateWorkerAuth(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.split(' ')[1];
  return token === WORKER_API_KEY;
}

/**
 * POST /api/jobs/worker
 * Starts the worker process to handle background jobs
 * This endpoint should be called by a scheduled task or cron job
 */
export async function POST(request: Request) {
  try {
    // Validate worker authentication
    if (!validateWorkerAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role client for worker operations
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const body = await request.json();
    const { mode = 'single', maxJobs = 1, jobId } = body;

    // Single job mode - process specific job
    if (mode === 'single' && jobId) {
      try {
        // Get the job details
        const { data: job, error: jobError } = await supabase
          .from('job_queue')
          .select('*')
          .eq('id', jobId)
          .single();

        if (jobError || !job) {
          return NextResponse.json(
            { error: `Job not found: ${jobError?.message || 'Unknown error'}` },
            { status: 404 }
          );
        }

        // Process the job based on its type
        switch (job.job_type) {
          case 'transcription':
            const result = await processTranscriptionJob(job, supabase);
            return NextResponse.json({ success: true, result });

          default:
            return NextResponse.json(
              { error: `Unsupported job type: ${job.job_type}` },
              { status: 400 }
            );
        }
      } catch (error: unknown) {
        console.error('Error processing job:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Update job status to failed
        await supabase
          .from('job_queue')
          .update({
            status: 'failed',
            error_message: errorMessage,
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);

        return NextResponse.json(
          { error: `Job processing failed: ${errorMessage}` },
          { status: 500 }
        );
      }
    }

    // Batch mode - get pending jobs
    if (mode === 'batch') {
      const { data: jobs, error: jobsError } = await supabase
        .from('job_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(maxJobs);

      if (jobsError) {
        return NextResponse.json(
          { error: `Failed to fetch jobs: ${jobsError.message}` },
          { status: 500 }
        );
      }

      if (!jobs || jobs.length === 0) {
        return NextResponse.json({ message: 'No pending jobs found' });
      }

      return NextResponse.json({ jobs });
    }

    return NextResponse.json(
      { error: 'Invalid mode specified' },
      { status: 400 }
    );

  } catch (error: unknown) {
    console.error('Worker API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(request: Request) {
  try {
    if (!validateWorkerAuth(request)) {
      console.log('Health check: Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Health check: Authorized request received');
    return NextResponse.json({ status: 'healthy' });
  } catch (error: unknown) {
    console.error('Health check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { status: 'unhealthy', error: errorMessage },
      { status: 500 }
    );
  }
} 