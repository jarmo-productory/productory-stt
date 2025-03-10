import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const WORKER_API_KEY = process.env.WORKER_API_KEY;

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
 * POST /api/jobs/reset-stuck
 * Resets jobs that have been stuck in the "processing" state for too long
 */
export async function POST(request: Request) {
  try {
    // Validate worker authentication
    if (!validateWorkerAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    const maxTimeMinutes = body.maxTimeMinutes || 30;

    // Calculate the cutoff time
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - maxTimeMinutes);

    // Find stuck jobs
    const { data: stuckJobs, error: findError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'processing')
      .lt('started_at', cutoffTime.toISOString());

    if (findError) {
      return NextResponse.json(
        { error: `Failed to find stuck jobs: ${findError.message}` },
        { status: 500 }
      );
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      return NextResponse.json({ resetCount: 0 });
    }

    // Reset each stuck job
    const resetPromises = stuckJobs.map(async (job) => {
      // Reset the job status
      const { error: jobError } = await supabase
        .from('job_queue')
        .update({
          status: 'pending',
          started_at: null,
          completed_at: null,
          error_message: `Job was stuck in processing state for more than ${maxTimeMinutes} minutes and was automatically reset`,
          attempts: job.attempts + 1
        })
        .eq('id', job.id);

      if (jobError) {
        console.error(`Failed to reset job ${job.id}:`, jobError);
        return false;
      }

      // If it's a transcription job, also reset the transcription status
      if (job.job_type === 'transcription' && job.payload?.transcription_id) {
        const { error: transcriptionError } = await supabase
          .from('transcriptions')
          .update({
            status: 'pending',
            error_message: `Reset due to stuck job after ${maxTimeMinutes} minutes`
          })
          .eq('id', job.payload.transcription_id);

        if (transcriptionError) {
          console.error(`Failed to reset transcription ${job.payload.transcription_id}:`, transcriptionError);
          return false;
        }
      }

      return true;
    });

    // Wait for all reset operations to complete
    const results = await Promise.all(resetPromises);
    const resetCount = results.filter(Boolean).length;

    return NextResponse.json({
      resetCount,
      totalFound: stuckJobs.length,
      failedResets: stuckJobs.length - resetCount
    });

  } catch (error: any) {
    console.error('Error resetting stuck jobs:', error);
    return NextResponse.json(
      { error: `Failed to reset stuck jobs: ${error.message}` },
      { status: 500 }
    );
  }
} 