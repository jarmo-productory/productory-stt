import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/jobs/reset
 * Resets a job to the pending state
 */
export async function POST(request: NextRequest) {
  // Verify worker API key
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== process.env.WORKER_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { jobId } = body;
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }
    
    // Create a direct Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase service role credentials');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Reset the job to pending
    const { data, error } = await supabase
      .from('job_queue')
      .update({ status: 'pending', started_at: null })
      .eq('id', jobId)
      .select('id, status');
    
    if (error) {
      console.error('Error resetting job:', error);
      return NextResponse.json(
        { error: 'Failed to reset job' },
        { status: 500 }
      );
    }
    
    // Also reset the transcription status
    const { data: job } = await supabase
      .from('job_queue')
      .select('payload')
      .eq('id', jobId)
      .single();
    
    if (job && job.payload && job.payload.transcription_id) {
      const { error: transcriptionError } = await supabase
        .from('transcriptions')
        .update({ status: 'pending' })
        .eq('id', job.payload.transcription_id);
      
      if (transcriptionError) {
        console.error('Error resetting transcription:', transcriptionError);
      }
    }
    
    return NextResponse.json({
      message: 'Job reset successfully',
      job: data
    });
  } catch (error) {
    console.error('Error in reset job API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 