import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// PUT handler for updating a folder
export async function PUT(
  request: NextRequest,
  { params }: { params: { folderId: string } }
) {
  const unwrappedParams = await Promise.resolve(params);
  const folderId = unwrappedParams.folderId;
  console.log(`PUT /api/folders/${folderId}: Starting folder update`);
  
  // Create a Supabase client with properly handled cookies for Next.js 15
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({
    cookies: () => cookieStore
  });
  
  // Check authentication
  console.log(`PUT /api/folders/${folderId}: Checking authentication`);
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.log(`PUT /api/folders/${folderId}: Unauthorized - No session found`);
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  
  console.log(`PUT /api/folders/${folderId}: User authenticated with ID: ${session.user.id}`);
  
  try {
    // Parse the request body
    const { name } = await request.json();
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      console.log(`PUT /api/folders/${folderId}: Invalid folder name provided`);
      return NextResponse.json(
        { error: 'Folder name is required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }
    
    // Check if the folder exists and belongs to the user
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .eq('user_id', session.user.id)
      .single();
    
    if (folderError || !folder) {
      console.log(`PUT /api/folders/${folderId}: Folder not found or doesn't belong to user`);
      return NextResponse.json(
        { error: 'Folder not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    
    // Update the folder
    console.log(`PUT /api/folders/${folderId}: Updating folder name to "${name}"`);
    const { data: updatedFolder, error: updateError } = await supabase
      .from('folders')
      .update({ 
        name: name.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', folderId)
      .select()
      .single();
    
    if (updateError) {
      console.error(`PUT /api/folders/${folderId}: Error updating folder:`, updateError);
      return NextResponse.json(
        { error: 'Failed to update folder', code: 'UPDATE_FAILED' },
        { status: 500 }
      );
    }
    
    console.log(`PUT /api/folders/${folderId}: Folder updated successfully`);
    return NextResponse.json({ folder: updatedFolder });
    
  } catch (error) {
    console.error(`PUT /api/folders/${folderId}: Unexpected error:`, error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

// DELETE handler for deleting a folder
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { folderId: string } }
) {
  const unwrappedParams = await Promise.resolve(params);
  const folderId = unwrappedParams.folderId;
  console.log(`DELETE /api/folders/${folderId}: Starting folder deletion`);
  
  // Create a Supabase client with properly handled cookies for Next.js 15
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({
    cookies: () => cookieStore
  });
  
  // Check authentication
  console.log(`DELETE /api/folders/${folderId}: Checking authentication`);
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.log(`DELETE /api/folders/${folderId}: Unauthorized - No session found`);
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  
  console.log(`DELETE /api/folders/${folderId}: User authenticated with ID: ${session.user.id}`);
  
  try {
    // Check if the folder exists and belongs to the user
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .eq('user_id', session.user.id)
      .single();
    
    if (folderError || !folder) {
      console.log(`DELETE /api/folders/${folderId}: Folder not found or doesn't belong to user`);
      return NextResponse.json(
        { error: 'Folder not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    
    // Check if the folder has any files
    const { count: fileCount, error: fileCountError } = await supabase
      .from('audio_files')
      .select('id', { count: 'exact', head: true })
      .eq('folder_id', folderId);
    
    if (fileCountError) {
      console.error(`DELETE /api/folders/${folderId}: Error checking files:`, fileCountError);
      return NextResponse.json(
        { error: 'Failed to check folder contents', code: 'CHECK_FAILED' },
        { status: 500 }
      );
    }
    
    // Soft delete the folder (set is_deleted to true)
    console.log(`DELETE /api/folders/${folderId}: Soft deleting folder`);
    const { error: deleteError } = await supabase
      .from('folders')
      .update({ 
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', folderId);
    
    if (deleteError) {
      console.error(`DELETE /api/folders/${folderId}: Error deleting folder:`, deleteError);
      return NextResponse.json(
        { error: 'Failed to delete folder', code: 'DELETE_FAILED' },
        { status: 500 }
      );
    }
    
    console.log(`DELETE /api/folders/${folderId}: Folder deleted successfully`);
    return NextResponse.json({ 
      success: true,
      message: 'Folder deleted successfully',
      fileCount: fileCount || 0
    });
    
  } catch (error) {
    console.error(`DELETE /api/folders/${folderId}: Unexpected error:`, error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
} 