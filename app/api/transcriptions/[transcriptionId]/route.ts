import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest, createAuthErrorResponse } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { transcriptionId: string } }
) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.userId) {
      return createAuthErrorResponse(authResult);
    }

    const transcriptionId = params.transcriptionId;
    const supabase = await createClient();

    // Fetch the transcription and join with audio_files to verify ownership
    const { data, error } = await supabase
      .from('transcriptions')
      .select(`
        *,
        audio_file:file_id(user_id)
      `)
      .eq('id', transcriptionId)
      .single();

    if (error || !data) {
      console.error('Error fetching transcription:', error);
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (data.audio_file?.user_id !== authResult.userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Remove the joined data before returning
    const transcription = data;

    // Fetch segments
    const { data: segments, error: segmentsError } = await supabase
      .from('transcription_segments')
      .select('*')
      .eq('transcription_id', transcriptionId)
      .order('sequence_number', { ascending: true });

    if (segmentsError) {
      console.error('Error fetching segments:', segmentsError);
    }

    return NextResponse.json({
      transcription,
      segments: segments || []
    });
  } catch (error) {
    console.error('Error fetching transcription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 