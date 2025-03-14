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
 * @param _req The Next.js request object (unused but kept for compatibility)
 * @returns Object containing userId if authenticated, or error details
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function authenticateRequest(_req: NextRequest): Promise<AuthResult> {
  try {
    // Use the official Supabase auth helper for route handlers
    const supabase = createRouteHandlerClient({ cookies });
    
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