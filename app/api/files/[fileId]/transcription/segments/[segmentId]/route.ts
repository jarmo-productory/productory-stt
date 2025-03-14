import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { authenticateRequest, createAuthErrorResponse } from '@/lib/auth';
import { verifyFileOwnership, createOwnershipErrorResponse } from '@/lib/files';
import { updateTranscriptionSegment } from '@/lib/transcriptions';

/**
 * PUT /api/files/:fileId/transcription/segments/:segmentId
 * Updates a specific transcription segment
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { fileId: string; segmentId: string } }
) {
  // Authenticate the request
  const authResult = await authenticateRequest(req);
  if (!authResult.userId) {
    return createAuthErrorResponse(authResult);
  }

  const { fileId, segmentId } = params;

  // Verify file ownership
  const ownershipResult = await verifyFileOwnership(authResult.userId, fileId);
  if (!ownershipResult.isOwner) {
    return createOwnershipErrorResponse(ownershipResult);
  }

  // Parse request body
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Validate request body
  if (!body || (
    typeof body.text !== 'string' && 
    typeof body.speaker_id !== 'string' && 
    typeof body.start_time !== 'number' && 
    typeof body.end_time !== 'number'
  )) {
    return NextResponse.json(
      { error: 'At least one valid update field is required' },
      { status: 400 }
    );
  }

  // Initialize Supabase client
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Verify that the segment belongs to the file's transcription
    const { data: segment, error: segmentError } = await supabase
      .from('transcription_segments')
      .select('id, transcription_id')
      .eq('id', segmentId)
      .single();

    if (segmentError) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      );
    }

    // Verify that the segment's transcription belongs to the file
    const { data: transcription, error: transcriptionError } = await supabase
      .from('transcriptions')
      .select('id, file_id')
      .eq('id', segment.transcription_id)
      .single();

    if (transcriptionError || transcription.file_id !== fileId) {
      return NextResponse.json(
        { error: 'Segment does not belong to the specified file' },
        { status: 403 }
      );
    }

    // Update the segment
    const updates = {
      text: body.text,
      speaker_id: body.speaker_id,
      start_time: body.start_time,
      end_time: body.end_time
    };

    const updatedSegment = await updateTranscriptionSegment(
      segmentId,
      updates
    );

    return NextResponse.json(updatedSegment);
  } catch (error) {
    console.error('Error updating transcription segment:', error);
    return NextResponse.json(
      { error: 'Failed to update transcription segment' },
      { status: 500 }
    );
  }
} 