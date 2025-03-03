import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase-admin';

// GET endpoint to fetch user profile
export async function GET() {
  try {
    console.log('GET /api/user/profile: Starting profile fetch');
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check if user is authenticated
    console.log('GET /api/user/profile: Checking authentication');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('GET /api/user/profile: Session error:', sessionError);
      return NextResponse.json({ error: 'Authentication error', details: sessionError }, { status: 401 });
    }
    
    if (!session) {
      console.error('GET /api/user/profile: Unauthorized access attempt - no session');
      return NextResponse.json({ error: 'Unauthorized - No session found' }, { status: 401 });
    }
    
    // Get user ID from session
    const userId = session.user.id;
    console.log('GET /api/user/profile: User authenticated with ID:', userId);
    
    // Fetch user profile
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('GET /api/user/profile: Error fetching profile:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch profile', 
        details: error 
      }, { status: 500 });
    }
    
    if (!profile) {
      console.log('GET /api/user/profile: Profile not found');
      return NextResponse.json({ 
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND'
      }, { status: 404 });
    }
    
    console.log('GET /api/user/profile: Profile fetched successfully');
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('GET /api/user/profile: Internal server error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

// POST endpoint to create or update user profile
export async function POST(request: Request) {
  try {
    console.log('POST /api/user/profile: Starting profile creation/update');
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check if user is authenticated
    console.log('POST /api/user/profile: Checking authentication');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('POST /api/user/profile: Session error:', sessionError);
      return NextResponse.json({ error: 'Authentication error', details: sessionError }, { status: 401 });
    }
    
    if (!session) {
      console.error('POST /api/user/profile: Unauthorized access attempt - no session');
      return NextResponse.json({ error: 'Unauthorized - No session found' }, { status: 401 });
    }
    
    // Get user ID from session
    const userId = session.user.id;
    console.log('POST /api/user/profile: User authenticated with ID:', userId);
    
    // Get profile data from request
    const body = await request.json();
    console.log('POST /api/user/profile: Request body:', body);
    
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('POST /api/user/profile: Error checking user existence:', checkError);
      return NextResponse.json({ 
        error: 'Error checking user existence', 
        details: checkError 
      }, { status: 500 });
    }
    
    let profile;
    
    // Use supabaseAdmin to bypass RLS policies
    if (!existingUser) {
      // Create new user profile
      console.log('POST /api/user/profile: Creating new user profile');
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert([
          { 
            id: userId,
            email: session.user.email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false,
            ...body // Include any additional fields from the request
          }
        ])
        .select()
        .single();
      
      if (error) {
        console.error('POST /api/user/profile: Error creating profile:', error);
        return NextResponse.json({ 
          error: 'Failed to create profile', 
          details: error 
        }, { status: 500 });
      }
      
      profile = data;
      console.log('POST /api/user/profile: Profile created successfully');
    } else {
      // Update existing user profile
      console.log('POST /api/user/profile: Updating existing user profile');
      const { data, error } = await supabase
        .from('users')
        .update({
          updated_at: new Date().toISOString(),
          ...body // Include any additional fields from the request
        })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) {
        console.error('POST /api/user/profile: Error updating profile:', error);
        return NextResponse.json({ 
          error: 'Failed to update profile', 
          details: error 
        }, { status: 500 });
      }
      
      profile = data;
      console.log('POST /api/user/profile: Profile updated successfully');
    }
    
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('POST /api/user/profile: Internal server error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 