import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthErrorResponse } from '@/lib/auth';
import { getJob, getJobLogs } from '@/lib/jobs';

/**
 * GET /api/jobs/:jobId
 * Gets the status of a job
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  // Authenticate the request
  const authResult = await authenticateRequest(req);
  if (!authResult.userId) {
    return createAuthErrorResponse(authResult);
  }

  // Properly await and destructure params
  const jobId = params.jobId;

  try {
    // Get job details
    const job = await getJob(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Check if the user owns the job
    if (job.user_id !== authResult.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Get job logs if requested
    const url = new URL(req.url);
    const includeLogs = url.searchParams.get('logs') === 'true';
    
    let logs = [];
    if (includeLogs) {
      logs = await getJobLogs(jobId);
    }
    
    return NextResponse.json({
      job,
      logs: includeLogs ? logs : undefined
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job data' },
      { status: 500 }
    );
  }
} 