import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/jobs/update
 * Updates a job's status
 */
export async function POST(request: NextRequest) {
  // Verify worker API key
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== process.env.WORKER_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { jobId, status } = body;
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }
    
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }
    
    // Validate status
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    
    // Create a direct Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase service role credentials');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Update the job status
    const updateData: any = { status };
    
    // Add timestamps based on status
    if (status === 'processing') {
      updateData.started_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('job_queue')
      .update(updateData)
      .eq('id', jobId)
      .select('id, status');
    
    if (error) {
      console.error('Error updating job:', error);
      return NextResponse.json(
        { error: 'Failed to update job' },
        { status: 500 }
      );
    }
    
    // Also update the transcription status
    const { data: job } = await supabase
      .from('job_queue')
      .select('payload')
      .eq('id', jobId)
      .single();
    
    if (job && job.payload && job.payload.transcription_id) {
      // Map job status to transcription status
      let transcriptionStatus = status;
      if (status === 'processing') {
        transcriptionStatus = 'processing';
      } else if (status === 'completed') {
        transcriptionStatus = 'completed';
      } else if (status === 'failed') {
        transcriptionStatus = 'failed';
      } else if (status === 'pending') {
        transcriptionStatus = 'pending';
      }
      
      const { error: transcriptionError } = await supabase
        .from('transcriptions')
        .update({ status: transcriptionStatus })
        .eq('id', job.payload.transcription_id);
      
      if (transcriptionError) {
        console.error('Error updating transcription:', transcriptionError);
      }
    }
    
    return NextResponse.json({
      message: 'Job updated successfully',
      job: data
    });
  } catch (error) {
    console.error('Error in update job API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 