import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthErrorResponse } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/transcriptions/:transcriptionId/job
 * Retrieves the job ID associated with a transcription
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { transcriptionId: string } }
) {
  // Authenticate the request
  const authResult = await authenticateRequest(req);
  if (!authResult.userId) {
    return createAuthErrorResponse(authResult);
  }

  const { transcriptionId } = params;
  console.log('Looking for job with transcription_id:', transcriptionId);

  try {
    const supabase = await createClient();
    
    // First, check if the transcription exists and belongs to the user
    const { data: transcription, error: transcriptionError } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('id', transcriptionId)
      .single();
    
    if (transcriptionError || !transcription) {
      console.error('Transcription not found:', transcriptionError);
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }
    
    // Try multiple approaches to find the job
    
    // Approach 1: Using contains
    try {
      console.log('Trying contains approach');
      const { data: job1, error: error1 } = await supabase
        .from('job_queue')
        .select('id')
        .contains('payload', { transcription_id: transcriptionId })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!error1 && job1) {
        console.log('Found job with contains approach:', job1.id);
        return NextResponse.json({ jobId: job1.id });
      } else if (error1) {
        console.error('Error with contains approach:', error1);
      }
    } catch (err) {
      console.error('Exception with contains approach:', err);
    }
    
    // Approach 2: Using text search in JSONB
    try {
      console.log('Trying text search approach');
      const { data: job2, error: error2 } = await supabase
        .from('job_queue')
        .select('id')
        .eq('job_type', 'transcription')
        .textSearch('payload', transcriptionId, {
          type: 'plain',
          config: 'english'
        })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!error2 && job2) {
        console.log('Found job with text search approach:', job2.id);
        return NextResponse.json({ jobId: job2.id });
      } else if (error2) {
        console.error('Error with text search approach:', error2);
      }
    } catch (err) {
      console.error('Exception with text search approach:', err);
    }
    
    // Approach 3: Using filter
    try {
      console.log('Trying filter approach');
      const { data: job3, error: error3 } = await supabase
        .from('job_queue')
        .select('id')
        .filter('payload->transcription_id', 'eq', transcriptionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!error3 && job3) {
        console.log('Found job with filter approach:', job3.id);
        return NextResponse.json({ jobId: job3.id });
      } else if (error3) {
        console.error('Error with filter approach:', error3);
      }
    } catch (err) {
      console.error('Exception with filter approach:', err);
    }
    
    // If we get here, we couldn't find a job
    console.log('No job found for transcription:', transcriptionId);
    return NextResponse.json({ jobId: null });
    
  } catch (error) {
    console.error('Error fetching job for transcription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 