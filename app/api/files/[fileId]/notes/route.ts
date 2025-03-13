import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { authenticateRequest, createAuthErrorResponse } from '@/lib/auth';
import { verifyFileOwnership, createOwnershipErrorResponse } from '@/lib/files';

/**
 * GET /api/files/:fileId/notes
 * Retrieves notes for a specific file
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  // Authenticate the request
  const authResult = await authenticateRequest(req);
  if (!authResult.userId) {
    return createAuthErrorResponse(authResult);
  }

  const { fileId } = await params;

  // Verify file ownership
  const ownershipResult = await verifyFileOwnership(authResult.userId, fileId);
  if (!ownershipResult.isOwner) {
    return createOwnershipErrorResponse(ownershipResult);
  }

  // Initialize Supabase client with auth helpers
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Query the file_notes table
    const { data, error } = await supabase
      .from('file_notes')
      .select('id, content, created_at, updated_at')
      .eq('file_id', fileId)
      .eq('user_id', authResult.userId)
      .single();

    if (error) {
      // If no note exists, return an empty content
      if (error.code === 'PGRST116') {
        return NextResponse.json({ content: '' });
      }

      console.error('Error fetching note:', error);
      return NextResponse.json(
        { error: 'Failed to fetch note' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/files/:fileId/notes
 * Updates notes for a specific file
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  // Authenticate the request
  const authResult = await authenticateRequest(req);
  if (!authResult.userId) {
    return createAuthErrorResponse(authResult);
  }

  const { fileId } = await params;

  // Verify file ownership
  const ownershipResult = await verifyFileOwnership(authResult.userId, fileId);
  if (!ownershipResult.isOwner) {
    return createOwnershipErrorResponse(ownershipResult);
  }

  // Parse request body
  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Validate request body
  if (!body || typeof body.content !== 'string') {
    return NextResponse.json(
      { error: 'Content is required and must be a string' },
      { status: 400 }
    );
  }

  // Initialize Supabase client with auth helpers
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // First check if the note exists
    const { data: existingNote } = await supabase
      .from('file_notes')
      .select('id')
      .eq('file_id', fileId)
      .eq('user_id', authResult.userId)
      .single();

    let result;
    
    if (existingNote) {
      // Update existing note
      result = await supabase
        .from('file_notes')
        .update({
          content: body.content,
          updated_at: new Date().toISOString()
        })
        .eq('file_id', fileId)
        .eq('user_id', authResult.userId)
        .select('id, content, created_at, updated_at')
        .single();
    } else {
      // Insert new note
      result = await supabase
        .from('file_notes')
        .insert({
          file_id: fileId,
          user_id: authResult.userId,
          content: body.content
        })
        .select('id, content, created_at, updated_at')
        .single();
    }

    if (result.error) {
      console.error('Error updating note:', result.error);
      return NextResponse.json(
        { error: 'Failed to update note' },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 