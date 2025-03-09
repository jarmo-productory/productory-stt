import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processTranscriptionJob } from '@/lib/jobs/transcription';

/**
 * POST /api/jobs/worker
 * Starts the worker process to handle background jobs
 * This endpoint should be called by a scheduled task or cron job
 */
export async function POST(request: NextRequest) {
  // Verify worker API key
  if (!verifyWorkerApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Get query parameters
  const searchParams = request.nextUrl.searchParams;
  const maxJobs = parseInt(searchParams.get('maxJobs') || '10', 10);
  const mode = searchParams.get('mode') || 'single';
  
  try {
    const supabase = await createClient();
    
    // Get pending jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(maxJobs);
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      );
    }
    
    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ message: 'No pending jobs found' });
    }
    
    console.log(`Processing ${jobs.length} jobs...`);
    
    // Process each job
    const results = [];
    for (const job of jobs) {
      try {
        // Mark job as processing
        const { error: updateError } = await supabase
          .from('job_queue')
          .update({ status: 'processing', started_at: new Date().toISOString() })
          .eq('id', job.id);
        
        if (updateError) {
          console.error(`Error updating job ${job.id} status:`, updateError);
          continue;
        }
        
        // Process job based on type
        let result;
        switch (job.job_type) {
          case 'transcription':
            result = await processTranscriptionJob(job, supabase);
            break;
          default:
            console.error(`Unknown job type: ${job.job_type}`);
            result = { success: false, error: `Unknown job type: ${job.job_type}` };
        }
        
        // Update job status based on result
        const status = result.success ? 'completed' : 'failed';
        const { error: finalUpdateError } = await supabase
          .from('job_queue')
          .update({
            status,
            completed_at: new Date().toISOString(),
            result: result
          })
          .eq('id', job.id);
        
        if (finalUpdateError) {
          console.error(`Error updating job ${job.id} final status:`, finalUpdateError);
        }
        
        results.push({
          jobId: job.id,
          type: job.job_type,
          status,
          success: result.success
        });
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        
        // Mark job as failed
        await supabase
          .from('job_queue')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            result: { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
          })
          .eq('id', job.id);
        
        results.push({
          jobId: job.id,
          type: job.job_type,
          status: 'failed',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      mode,
      processed: results.length,
      results
    });
  } catch (error) {
    console.error('Error in worker process:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Verify worker API key
function verifyWorkerApiKey(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const apiKey = authHeader.split(' ')[1];
  return apiKey === process.env.WORKER_API_KEY;
} 