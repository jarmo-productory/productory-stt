import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Auth callback handler for Supabase OAuth and email auth flows
 * Critical point in authentication workflow where code is exchanged for session
 */
export async function GET(request: Request) {
  // Add detailed debugging
  console.log('=================== AUTH CALLBACK DEBUG ===================');
  console.log('[Auth Debug] Full callback URL:', request.url);
  const requestUrl = new URL(request.url);
  console.log('[Auth Debug] Search params:', Object.fromEntries(requestUrl.searchParams));
  console.log('[Auth Debug] Referrer:', request.headers.get('referer'));
  console.log('===========================================================');

  // Get the request URL and parameters
  const code = requestUrl.searchParams.get('code');

  // If no code is provided, redirect to home
  if (!code) {
    console.log('[Auth Callback] No code found, redirecting to home');
    return NextResponse.redirect(new URL('/', requestUrl.origin));
  }

  try {
    console.log('[Auth Callback] Processing auth callback with code');

    // Create a Supabase client with awaited cookies
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Exchange the code for a session
    console.log('[Auth Callback] Exchanging code for session');
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Auth Callback] Error exchanging code for session:', error.message);
      return NextResponse.redirect(
        new URL(
          `/?error=auth_error&message=${encodeURIComponent(error.message)}`,
          requestUrl.origin
        )
      );
    }

    if (!data.session) {
      console.error('[Auth Callback] No session returned after code exchange');
      return NextResponse.redirect(new URL('/?error=no_session', requestUrl.origin));
    }

    console.log('[Auth Callback] Session established successfully');
    console.log('[Auth Callback] User authenticated with ID:', data.session.user.id);

    // Create response with strong cache control headers
    const response = NextResponse.redirect(new URL('/dashboard', requestUrl.origin));

    // Set cache-control to ensure the response isn't cached
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('[Auth Callback] Auth error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/?error=auth_error&message=${encodeURIComponent(errorMessage)}`, requestUrl.origin)
    );
  }
}
