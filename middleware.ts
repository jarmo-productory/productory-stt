import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * EMERGENCY FIX: Temporarily disabled redirects to break infinite loop
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const requestUrl = new URL(request.url);
  const path = requestUrl.pathname;
  
  // Skip middleware for these paths
  if (
    path.includes('_next') ||
    path.includes('/api/') ||
    path.startsWith('/assets/') ||
    path.startsWith('/favicon.ico') ||
    path.includes('/auth/') // Skip auth paths to prevent loops
  ) {
    return response;
  }
  
  try {
    // Create Supabase client
    const supabase = createMiddlewareClient({ req: request, res: response });
    
    // Check if there's a session
    const { data: { session } } = await supabase.auth.getSession();
    
    // Log the status - for debugging
    console.log(`[Middleware] Path: ${path}, Session:`, session ? 'exists' : 'none');
    
    // Set headers for debugging issues
    response.headers.set('x-middleware-cache', 'no-cache');
    response.headers.set('x-auth-state', session ? 'authenticated' : 'unauthenticated');
    response.headers.set('x-requested-path', path);
    
    // Define protected routes
    const isProtectedRoute = path.startsWith('/dashboard') || 
                            path.startsWith('/folders') || 
                            path.startsWith('/files') || 
                            path.startsWith('/account');
    
    // Check if the user has an active session for protected routes
    if (isProtectedRoute && !session) {
      console.log(`[Middleware] Redirecting unauthenticated user from ${path} to /`);
      
      // Instead of redirecting directly to home, redirect to a special auth sync page
      // This will check if there's an issue with session synchronization
      return NextResponse.redirect(new URL('/auth/sync?destination=' + encodeURIComponent(path), requestUrl.origin));
    }
    
    // Don't redirect authenticated users automatically - the client will handle it
    
    return response;
  } catch (error) {
    console.error('[Middleware] Error:', error);
    return response; // Continue the request in case of error
  }
}

// Simple matcher that excludes static assets
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 