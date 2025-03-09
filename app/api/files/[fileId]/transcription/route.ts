import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { authenticateRequest, createAuthErrorResponse } from '@/lib/auth';
import { verifyFileOwnership, createOwnershipErrorResponse } from '@/lib/files';
import { getTranscription, createTranscription } from '@/lib/transcriptions';
import { createJob } from '@/lib/jobs';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/files/:fileId/transcription
 * Retrieves transcription data for a specific file
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  // Authenticate the request
  const authResult = await authenticateRequest(req);
  if (!authResult.userId) {
    return createAuthErrorResponse(authResult);
  }

  const { fileId } = params;

  // Verify file ownership
  const ownershipResult = await verifyFileOwnership(authResult.userId, fileId);
  if (!ownershipResult.isOwner) {
    return createOwnershipErrorResponse(ownershipResult);
  }

  try {
    // Get transcription data
    const transcriptionData = await getTranscription(fileId, authResult.userId);
    
    return NextResponse.json(transcriptionData);
  } catch (error) {
    console.error('Error fetching transcription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcription data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/files/:fileId/transcription
 * Creates a new transcription request for a file
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.userId) {
      return createAuthErrorResponse(authResult);
    }

    const fileId = params.fileId;
    const body = await request.json();
    
    const {
      language = 'en',
      diarize = true,
      numSpeakers = 2,
      timestampsGranularity = 'word',
      tagAudioEvents = true,
    } = body;

    const supabase = await createClient();

    // Check if file exists and belongs to user
    const { data: file, error: fileError } = await supabase
      .from('audio_files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', authResult.userId)
      .single();

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    // Check if file already has a transcription
    const { data: existingTranscription, error: transcriptionError } = await (await createClient())
      .from('transcriptions')
      .select('*')
      .eq('file_id', fileId)
      .maybeSingle();

    if (existingTranscription) {
      return NextResponse.json(
        { error: 'File already has a transcription' },
        { status: 400 }
      );
    }

    // Create a new transcription record
    const transcriptionId = uuidv4();
    const { data: transcription, error: createError } = await (await createClient())
      .from('transcriptions')
      .insert({
        id: transcriptionId,
        file_id: fileId,
        status: 'pending',
        language,
        model_id: 'scribe_v1'
      })
      .select('*')
      .single();

    if (createError) {
      console.error('Error creating transcription:', createError);
      return NextResponse.json(
        { error: 'Failed to create transcription' },
        { status: 500 }
      );
    }

    // Create a job to process the transcription
    const jobId = uuidv4();
    const { data: job, error: jobError } = await (await createClient())
      .from('job_queue')
      .insert({
        id: jobId,
        user_id: authResult.userId,
        job_type: 'transcription',
        status: 'pending',
        priority: 0,
        payload: {
          transcription_id: transcriptionId,
          file_id: fileId,
          file_url: file.url,
          language,
          diarize,
          num_speakers: diarize ? numSpeakers : undefined,
          timestamps_granularity: timestampsGranularity,
          tag_audio_events: tagAudioEvents
        }
      })
      .select('*')
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      // Rollback transcription creation
      await (await createClient())
        .from('transcriptions')
        .delete()
        .eq('id', transcriptionId);
        
      return NextResponse.json(
        { error: 'Failed to create transcription job' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transcription,
      job
    });
  } catch (error) {
    console.error('Error in transcription request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 