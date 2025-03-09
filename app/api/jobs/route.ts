import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthErrorResponse } from '@/lib/auth';
import { getUserJobs, JobStatus } from '@/lib/jobs';

/**
 * GET /api/jobs
 * Lists jobs for the authenticated user
 */
export async function GET(req: NextRequest) {
  // Authenticate the request
  const authResult = await authenticateRequest(req);
  if (!authResult.userId) {
    return createAuthErrorResponse(authResult);
  }

  try {
    // Get query parameters
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as JobStatus | undefined;
    
    // Get jobs for the user
    const jobs = await getUserJobs(authResult.userId, status);
    
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
} 