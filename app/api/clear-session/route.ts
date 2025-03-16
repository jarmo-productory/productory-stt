import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Emergency API route to clear the authentication session
 */
export async function POST() {
  try {
    // Create a Supabase client with proper Next.js 15 cookie handling
    const supabase = createRouteHandlerClient({ cookies });

    // Sign out the user to clear the session
    await supabase.auth.signOut();

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Session cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing session:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to clear session',
      },
      { status: 500 }
    );
  }
}
