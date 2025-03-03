import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Auth callback handler for Supabase OAuth and email auth flows
 * Critical point in authentication workflow where code is exchanged for session
 */
export async function GET(request: Request) {
  // Get the request URL and parameters
  const requestUrl = new URL(request.url);
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
      return NextResponse.redirect(new URL(`/?error=auth_error`, requestUrl.origin));
    }
    
    if (!data.session) {
      console.error('[Auth Callback] No session returned after code exchange');
      return NextResponse.redirect(new URL('/?error=no_session', requestUrl.origin));
    }
    
    console.log('[Auth Callback] Session established successfully');
    console.log('[Auth Callback] User authenticated with ID:', data.session.user.id);
    
    // Use a special landing page that will verify auth status before redirecting
    // This ensures server and client are in sync regarding authentication
    const response = NextResponse.redirect(
      new URL('/auth/sync?destination=/dashboard', requestUrl.origin)
    );
    
    // Set cache-control to ensure the response isn't cached
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  } catch (error) {
    console.error('[Auth Callback] Auth error:', error);
    return NextResponse.redirect(new URL('/?error=auth_error', requestUrl.origin));
  }
} 