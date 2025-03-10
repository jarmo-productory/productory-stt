import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthErrorResponse } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/jobs
 * Retrieves jobs with optional filtering by transcription_id
 */
export async function GET(req: NextRequest) {
  // Authenticate the request
  const authResult = await authenticateRequest(req);
  if (!authResult.userId) {
    return createAuthErrorResponse(authResult);
  }

  // Get query parameters
  const searchParams = req.nextUrl.searchParams;
  const transcriptionId = searchParams.get('transcription_id');

  try {
    const supabase = await createClient();
    
    // If transcription_id is provided, find jobs for that transcription
    if (transcriptionId) {
      console.log(`Fetching jobs for transcription ID: ${transcriptionId}`);
      
      try {
        // Approach 1: Using filter on JSONB payload
        const { data: jobs, error } = await supabase
          .from('job_queue')
          .select('*')
          .eq('job_type', 'transcription')
          .eq('user_id', authResult.userId)
          .filter('payload->transcription_id', 'eq', transcriptionId)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching jobs by transcription ID:', error);
          
          // Fallback approach: Using raw SQL query
          console.log('Trying fallback approach with direct query');
          const { data: fallbackJobs, error: fallbackError } = await supabase
            .from('job_queue')
            .select('*')
            .eq('job_type', 'transcription')
            .eq('user_id', authResult.userId)
            .order('created_at', { ascending: false });
            
          if (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            return NextResponse.json(
              { error: 'Failed to fetch jobs' },
              { status: 500 }
            );
          }
          
          // Filter jobs manually
          const filteredJobs = fallbackJobs?.filter(job => 
            job.payload && job.payload.transcription_id === transcriptionId
          ) || [];
          
          console.log(`Found ${filteredJobs.length} jobs after manual filtering`);
          return NextResponse.json({ jobs: filteredJobs });
        }
        
        console.log(`Found ${jobs?.length || 0} jobs for transcription ID ${transcriptionId}`);
        return NextResponse.json({ jobs });
      } catch (queryError) {
        console.error('Exception in transcription job query:', queryError);
        return NextResponse.json(
          { error: 'Error querying jobs' },
          { status: 500 }
        );
      }
    }
    
    // Otherwise, return all jobs for the user
    const { data: jobs, error } = await supabase
      .from('job_queue')
      .select('*')
      .eq('user_id', authResult.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error fetching jobs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Error in jobs API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 