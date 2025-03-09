import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export type AuthResult = {
  userId: string | null;
  error?: string;
  status?: number;
};

/**
 * Authenticates a request and returns the user ID if authenticated
 * @param req The Next.js request object
 * @returns Object containing userId if authenticated, or error details
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  try {
    const cookieStore = cookies();
    
    // Use the official Supabase auth helper for route handlers
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get the session using the built-in method
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return {
        userId: null,
        error: 'No valid session found',
        status: 401
      };
    }
    
    return {
      userId: session.user.id
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      userId: null,
      error: 'Server authentication error',
      status: 500
    };
  }
}

/**
 * Creates a response for authentication errors
 * @param result The authentication result
 * @returns NextResponse with appropriate error status and message
 */
export function createAuthErrorResponse(result: AuthResult): NextResponse {
  return NextResponse.json(
    { error: result.error || 'Authentication error' },
    { status: result.status || 401 }
  );
} 