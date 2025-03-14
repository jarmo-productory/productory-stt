import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createElevenLabsClient, TranscriptionOptions, TranscriptionWord } from './elevenlabs';
import path from 'path';
import fs from 'fs';

// Define transcription status types
export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Fetches a transcription for a specific file
 * @param fileId The ID of the file
 * @returns The transcription data with its segments
 */
export async function getTranscription(fileId: string) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // First get the transcription metadata
  const { data: transcription, error: transcriptionError } = await supabase
    .from('transcriptions')
    .select('id, status, language, language_probability, raw_text, model_id, created_at, updated_at')
    .eq('file_id', fileId)
    .single();

  if (transcriptionError) {
    // If no transcription exists, return null
    if (transcriptionError.code === 'PGRST116') {
      return { transcription: null, segments: [] };
    }
    throw transcriptionError;
  }

  // Then get the segments if transcription exists
  if (transcription) {
    const { data: segments, error: segmentsError } = await supabase
      .from('transcription_segments')
      .select('id, start_time, end_time, speaker_id, text, original_text, type, sequence_number, created_at, updated_at')
      .eq('transcription_id', transcription.id)
      .order('sequence_number', { ascending: true });

    if (segmentsError) {
      throw segmentsError;
    }

    return { transcription, segments: segments || [] };
  }

  return { transcription, segments: [] };
}

/**
 * Creates a new transcription request
 * @param fileId The ID of the file
 * @param options Transcription options
 * @returns The created transcription record
 */
export async function createTranscription(
  fileId: string,
  options: {
    language?: string;
    modelId?: string;
    diarize?: boolean;
    numSpeakers?: number;
    timestampsGranularity?: 'word' | 'character' | 'none';
    tagAudioEvents?: boolean;
  } = {}
) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // Create a new transcription record with pending status
  const { data, error } = await supabase
    .from('transcriptions')
    .insert({
      file_id: fileId,
      status: 'pending',
      language: options.language || 'en',
      model_id: options.modelId || 'scribe_v1'
    })
    .select('id, status, language, model_id, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Processes a transcription using the Elevenlabs API
 * @param fileId The ID of the file
 * @param transcriptionId The ID of the transcription
 * @param options Transcription options
 * @returns The processed transcription data
 */
export async function processTranscription(
  fileId: string,
  transcriptionId: string,
  options: TranscriptionOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Update status to processing
    await supabase
      .from('transcriptions')
      .update({ status: 'processing' as TranscriptionStatus })
      .eq('id', transcriptionId);

    // Get file path from storage
    const { data: fileData, error: fileError } = await supabase
      .from('audio_files')
      .select('file_path')
      .eq('id', fileId)
      .single();

    if (fileError || !fileData) {
      throw new Error(`File not found: ${fileError?.message || 'Unknown error'}`);
    }

    // Download file from storage
    const { data: fileContent, error: downloadError } = await supabase
      .storage
      .from('audio-files')
      .download(fileData.file_path);

    if (downloadError || !fileContent) {
      throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
    }

    // Save file to temp directory
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, path.basename(fileData.file_path));
    fs.writeFileSync(tempFilePath, Buffer.from(await fileContent.arrayBuffer()));

    // Initialize Elevenlabs client
    const elevenLabsClient = createElevenLabsClient();

    // Transcribe the file
    const transcriptionResponse = await elevenLabsClient.transcribeFile(tempFilePath, options);

    // Update transcription record with results
    await supabase
      .from('transcriptions')
      .update({
        status: 'completed' as TranscriptionStatus,
        language: transcriptionResponse.language_code,
        language_probability: transcriptionResponse.language_probability,
        raw_text: transcriptionResponse.text,
        updated_at: new Date().toISOString()
      })
      .eq('id', transcriptionId);

    // Process and store segments
    await storeTranscriptionSegments(transcriptionId, transcriptionResponse.words);

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    return { success: true };
  } catch (error: unknown) {
    console.error('Error processing transcription:', error);
    
    // Update transcription status to failed
    await supabase
      .from('transcriptions')
      .update({
        status: 'failed' as TranscriptionStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', transcriptionId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Stores transcription segments in the database
 * @param transcriptionId The ID of the transcription
 * @param words The words from the transcription response
 */
async function storeTranscriptionSegments(
  transcriptionId: string,
  words: TranscriptionWord[]
): Promise<void> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // Process words into segments
  // For simplicity, we'll treat each word as a separate segment
  // In a real implementation, you might want to group words into sentences or paragraphs
  const segments = words.map((word, index) => ({
    transcription_id: transcriptionId,
    start_time: word.start || 0,
    end_time: word.end || 0,
    speaker_id: word.speaker_id || null,
    text: word.text,
    type: word.type,
    sequence_number: index
  }));

  // Insert segments in batches to avoid hitting request size limits
  const batchSize = 100;
  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);
    const { error } = await supabase
      .from('transcription_segments')
      .insert(batch);

    if (error) {
      throw error;
    }
  }
}

/**
 * Updates a transcription segment
 * @param segmentId The ID of the segment to update
 * @param updates The updates to apply
 * @returns The updated segment
 */
export async function updateTranscriptionSegment(
  segmentId: string,
  updates: {
    text?: string;
    speaker_id?: string;
    start_time?: number;
    end_time?: number;
  }
) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // First, get the current segment to preserve original_text if needed
  const { data: currentSegment, error: fetchError } = await supabase
    .from('transcription_segments')
    .select('id, text, original_text')
    .eq('id', segmentId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  // If this is the first edit and original_text is not set, preserve the original text
  const updateData: any = { ...updates };
  if (updates.text && !currentSegment.original_text) {
    updateData.original_text = currentSegment.text;
  }

  // Update the segment
  const { data, error } = await supabase
    .from('transcription_segments')
    .update(updateData)
    .eq('id', segmentId)
    .select('id, start_time, end_time, speaker_id, text, original_text, type, sequence_number, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Formats transcription data for export
 * @param fileId The ID of the file
 * @param format The export format (txt, srt, etc.)
 * @returns Formatted transcription data
 */
export async function exportTranscription(
  fileId: string,
  format: 'txt' | 'srt' = 'txt'
) {
  const { transcription, segments } = await getTranscription(fileId);
  
  if (!transcription || segments.length === 0) {
    throw new Error('No transcription data available for export');
  }

  if (format === 'txt') {
    // Simple text format - just concatenate all segments
    return segments.map(segment => segment.text).join(' ');
  } else if (format === 'srt') {
    // SRT subtitle format
    return segments.map((segment, index) => {
      const startTime = formatSrtTime(segment.start_time);
      const endTime = formatSrtTime(segment.end_time);
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text}\n`;
    }).join('\n');
  }

  throw new Error(`Unsupported export format: ${format}`);
}

/**
 * Formats time in seconds to SRT time format (HH:MM:SS,mmm)
 */
function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
} 