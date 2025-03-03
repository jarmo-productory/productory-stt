import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('GET /api/folders: Starting folder fetch');
    
    // Create a Supabase client with properly handled cookies for Next.js 15
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore
    });
    
    // Check if user is authenticated
    console.log('GET /api/folders: Checking authentication');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('GET /api/folders: Session error:', sessionError);
      return NextResponse.json({ error: 'Authentication error', details: sessionError }, { status: 401 });
    }
    
    if (!session) {
      console.error('GET /api/folders: Unauthorized access attempt - no session');
      return NextResponse.json({ error: 'Unauthorized - No session found' }, { status: 401 });
    }
    
    // Get user ID from session
    const userId = session.user.id;
    console.log('GET /api/folders: User authenticated with ID:', userId);
    
    // Check if user exists in the users table
    console.log('GET /api/folders: Checking if user exists in users table');
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userCheckError && userCheckError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('GET /api/folders: Error checking user existence:', userCheckError);
      return NextResponse.json({ 
        error: 'Error checking user existence', 
        details: userCheckError 
      }, { status: 500 });
    }
    
    // If user doesn't exist in users table, return a specific error
    if (!existingUser) {
      console.log('GET /api/folders: User not found in users table');
      return NextResponse.json({ 
        error: 'User profile not found',
        message: 'Please complete your profile setup before accessing folders',
        code: 'USER_NOT_FOUND'
      }, { status: 404 });
    }
    
    // Fetch folders for the user
    console.log('GET /api/folders: Fetching folders for user');
    const { data: folders, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .is('is_deleted', false)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('GET /api/folders: Error fetching folders:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch folders', 
        details: error 
      }, { status: 500 });
    }
    
    console.log(`GET /api/folders: Successfully fetched ${folders.length} folders`);
    return NextResponse.json({ folders });
  } catch (error) {
    console.error('GET /api/folders: Internal server error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log('POST /api/folders: Starting folder creation');
    
    // Create a Supabase client with properly handled cookies for Next.js 15
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore
    });
    
    // Check if user is authenticated
    console.log('POST /api/folders: Checking authentication');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('POST /api/folders: Session error:', sessionError);
      return NextResponse.json({ error: 'Authentication error', details: sessionError }, { status: 401 });
    }
    
    if (!session) {
      console.error('POST /api/folders: Unauthorized access attempt - no session');
      return NextResponse.json({ error: 'Unauthorized - No session found' }, { status: 401 });
    }
    
    // Get user ID from session
    const userId = session.user.id;
    console.log('POST /api/folders: User authenticated with ID:', userId);
    
    // Check if user exists in the users table
    console.log('POST /api/folders: Checking if user exists in users table');
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userCheckError && userCheckError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('POST /api/folders: Error checking user existence:', userCheckError);
      return NextResponse.json({ 
        error: 'Error checking user existence', 
        details: userCheckError 
      }, { status: 500 });
    }
    
    // If user doesn't exist in users table, return a specific error
    if (!existingUser) {
      console.log('POST /api/folders: User not found in users table');
      return NextResponse.json({ 
        error: 'User profile not found',
        message: 'Please complete your profile setup before creating folders',
        code: 'USER_NOT_FOUND'
      }, { status: 404 });
    }
    
    // Get folder data from request
    const body = await request.json();
    console.log('POST /api/folders: Request body:', body);
    
    const { name, parent_id } = body;
    
    if (!name || name.trim() === '') {
      console.error('POST /api/folders: Missing folder name');
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }
    
    console.log('POST /api/folders: Attempting to insert folder into database');
    // Create folder in database
    const { data: folder, error } = await supabase
      .from('folders')
      .insert([
        { 
          name, 
          user_id: userId,
          parent_id: parent_id || null
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('POST /api/folders: Error creating folder:', error);
      return NextResponse.json({ 
        error: 'Failed to create folder', 
        details: error 
      }, { status: 500 });
    }
    
    console.log('POST /api/folders: Folder created successfully:', folder);
    return NextResponse.json({ folder });
  } catch (error) {
    console.error('POST /api/folders: Internal server error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 