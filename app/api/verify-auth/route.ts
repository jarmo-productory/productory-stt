import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * API endpoint to verify authentication status
 * This serves as a synchronization point between client and server
 */
export async function GET() {
  try {
    // Use server-side client to check session with proper Next.js 15 cookie handling
    const supabase = createRouteHandlerClient({ cookies });
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[Verify Auth] Error checking session:', error.message);
      return NextResponse.json(
        {
          authenticated: false,
          error: error.message,
        },
        { status: 401 }
      );
    }

    // Return authenticated status based on session existence
    const authenticated = !!data.session;
    const userId = data.session?.user?.id;

    console.log(
      `[Verify Auth] User ${authenticated ? 'is' : 'is not'} authenticated`,
      userId ? `(ID: ${userId})` : ''
    );

    return NextResponse.json(
      {
        authenticated,
        userId,
        timestamp: new Date().toISOString(),
      },
      {
        status: authenticated ? 200 : 401,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('[Verify Auth] Unexpected error:', error);
    return NextResponse.json(
      {
        authenticated: false,
        error: 'Unexpected error checking authentication',
      },
      { status: 500 }
    );
  }
}
