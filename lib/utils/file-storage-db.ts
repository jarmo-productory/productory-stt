/**
 * Utilities for working with the enhanced database schema for file storage
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { storagePathUtil } from './storage';

/**
 * Interface for transcription format information
 */
export interface TranscriptionFormat {
  path: string;
  format: string;
  sample_rate: number;
  channels: number;
  created_at: string;
}

/**
 * Interface for audio file database record with enhanced schema
 */
export interface AudioFile {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  normalized_path?: string;
  bucket_name?: string;
  storage_prefix?: string;
  format?: string;
  size?: number;
  duration?: number;
  status?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  folder_id?: string | null;
  transcription_formats?: {
    optimized?: TranscriptionFormat;
    google?: TranscriptionFormat;
    whisper?: TranscriptionFormat;
  };
}

/**
 * Options for creating a new audio file record
 */
export interface CreateAudioFileOptions {
  userId: string;
  fileName: string;
  filePath: string;
  format?: string;
  size?: number;
  duration?: number;
  status?: string;
  metadata?: Record<string, any>;
  folderId?: string | null;
}

/**
 * Create a new audio file record in the database
 * @param supabase Supabase client
 * @param options Options for creating the audio file
 * @returns The created audio file record
 */
export async function createAudioFile(
  supabase: SupabaseClient,
  options: CreateAudioFileOptions
): Promise<AudioFile | null> {
  try {
    const { 
      userId, 
      fileName, 
      filePath, 
      format, 
      size, 
      duration, 
      status = 'ready',
      metadata = {},
      folderId = null
    } = options;

    // Get storage configuration from StoragePathUtil
    const bucketName = storagePathUtil.getBucketConfig().defaultBucket;
    const storagePrefix = storagePathUtil.getBucketConfig().audioPathPrefix;

    // Insert the record with enhanced schema fields
    const { data, error } = await supabase
      .from('audio_files')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_path: filePath,
        bucket_name: bucketName,
        storage_prefix: storagePrefix,
        format,
        size,
        duration,
        status,
        metadata,
        folder_id: folderId
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating audio file record:', error);
      return null;
    }

    return data as AudioFile;
  } catch (error) {
    console.error('Error creating audio file record:', error);
    return null;
  }
}

/**
 * Get an audio file record by ID
 * @param supabase Supabase client
 * @param fileId File ID
 * @returns The audio file record
 */
export async function getAudioFile(
  supabase: SupabaseClient,
  fileId: string
): Promise<AudioFile | null> {
  try {
    const { data, error } = await supabase
      .from('audio_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error) {
      console.error('Error getting audio file record:', error);
      return null;
    }

    return data as AudioFile;
  } catch (error) {
    console.error('Error getting audio file record:', error);
    return null;
  }
}

/**
 * Get the storage path for an audio file
 * @param file Audio file record
 * @returns The storage path for the file
 */
export function getAudioFilePath(file: AudioFile): string {
  // Use normalized_path if available, otherwise construct it
  if (file.normalized_path) {
    return file.normalized_path;
  }

  // Fallback to constructing the path using StoragePathUtil
  return storagePathUtil.getAudioPath(file.user_id, file.file_name);
}

/**
 * Get the public URL for an audio file
 * @param file Audio file record
 * @returns The public URL for the file
 */
export function getAudioFileUrl(file: AudioFile): string {
  // Use normalized_path if available, otherwise construct it
  const path = file.normalized_path || 
    storagePathUtil.getAudioPath(file.user_id, file.file_name);
  
  // Use bucket_name if available, otherwise use default
  const bucket = file.bucket_name || 
    storagePathUtil.getBucketConfig().defaultBucket;
  
  // Get the public URL
  return storagePathUtil.getPublicUrl(path, bucket);
}

/**
 * Update an audio file record
 * @param supabase Supabase client
 * @param fileId File ID
 * @param updates Updates to apply
 * @returns The updated audio file record
 */
export async function updateAudioFile(
  supabase: SupabaseClient,
  fileId: string,
  updates: Partial<Omit<AudioFile, 'id' | 'user_id' | 'normalized_path'>>
): Promise<AudioFile | null> {
  try {
    const { data, error } = await supabase
      .from('audio_files')
      .update(updates)
      .eq('id', fileId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating audio file record:', error);
      return null;
    }

    return data as AudioFile;
  } catch (error) {
    console.error('Error updating audio file record:', error);
    return null;
  }
}

/**
 * Delete an audio file record
 * @param supabase Supabase client
 * @param fileId File ID
 * @returns True if the file was deleted, false otherwise
 */
export async function deleteAudioFile(
  supabase: SupabaseClient,
  fileId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('audio_files')
      .delete()
      .eq('id', fileId);

    if (error) {
      console.error('Error deleting audio file record:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting audio file record:', error);
    return false;
  }
}

/**
 * List audio files for a user
 * @param supabase Supabase client
 * @param userId User ID
 * @param options Options for listing files
 * @returns Array of audio file records
 */
export async function listAudioFiles(
  supabase: SupabaseClient,
  userId: string,
  options: {
    folderId?: string | null;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  } = {}
): Promise<AudioFile[]> {
  try {
    const { 
      folderId = null, 
      limit = 100, 
      offset = 0, 
      sortBy = 'created_at', 
      sortDirection = 'desc' 
    } = options;

    let query = supabase
      .from('audio_files')
      .select('*')
      .eq('user_id', userId)
      .order(sortBy, { ascending: sortDirection === 'asc' })
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Add folder filter if specified
    if (folderId !== undefined) {
      query = query.eq('folder_id', folderId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing audio files:', error);
      return [];
    }

    return data as AudioFile[];
  } catch (error) {
    console.error('Error listing audio files:', error);
    return [];
  }
}

/**
 * Search audio files for a user
 * @param supabase Supabase client
 * @param userId User ID
 * @param searchTerm Search term
 * @param options Options for searching files
 * @returns Array of audio file records
 */
export async function searchAudioFiles(
  supabase: SupabaseClient,
  userId: string,
  searchTerm: string,
  options: {
    folderId?: string | null;
    limit?: number;
    offset?: number;
  } = {}
): Promise<AudioFile[]> {
  try {
    const { 
      folderId = null, 
      limit = 100, 
      offset = 0 
    } = options;

    let query = supabase
      .from('audio_files')
      .select('*')
      .eq('user_id', userId)
      .ilike('file_name', `%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Add folder filter if specified
    if (folderId !== undefined) {
      query = query.eq('folder_id', folderId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error searching audio files:', error);
      return [];
    }

    return data as AudioFile[];
  } catch (error) {
    console.error('Error searching audio files:', error);
    return [];
  }
}

/**
 * Add or update a transcription format for an audio file
 * @param supabase Supabase client
 * @param fileId ID of the audio file
 * @param formatInfo Information about the transcription format
 * @returns The updated audio file or null if an error occurred
 */
export async function addTranscriptionFormat(
  supabase: SupabaseClient,
  fileId: string,
  formatInfo: Omit<TranscriptionFormat, 'created_at'>
): Promise<AudioFile | null> {
  try {
    // Get the current audio file to access existing transcription formats
    const { data: existingFile, error: fetchError } = await supabase
      .from('audio_files')
      .select('transcription_formats')
      .eq('id', fileId)
      .single();

    if (fetchError) {
      console.error('Error fetching audio file:', fetchError);
      return null;
    }

    // Create a new transcription format object with the current timestamp
    const newFormat: TranscriptionFormat = {
      ...formatInfo,
      created_at: new Date().toISOString()
    };

    // Create or update the transcription_formats object
    const updatedFormats = {
      ...(existingFile?.transcription_formats || {}),
      optimized: newFormat
    };

    // Update the audio file with the new transcription formats
    const { data, error } = await supabase
      .from('audio_files')
      .update({ transcription_formats: updatedFormats })
      .eq('id', fileId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating transcription format:', error);
      return null;
    }

    return data as AudioFile;
  } catch (error) {
    console.error('Error adding transcription format:', error);
    return null;
  }
}

/**
 * Get the transcription format path if available
 * @param audioFile The audio file record
 * @returns The path to the transcription format or the original file path if not available
 */
export function getTranscriptionFormatPath(
  audioFile: AudioFile
): string {
  // If optimized format is available, use it
  if (audioFile.transcription_formats?.optimized) {
    return audioFile.transcription_formats.optimized.path;
  }

  // If no transcription format is available, use the original
  return audioFile.file_path;
}

/**
 * Check if the optimized transcription format is available for an audio file
 * @param audioFile The audio file record
 * @returns Whether the optimized transcription format is available
 */
export function isTranscriptionFormatAvailable(
  audioFile: AudioFile
): boolean {
  return (
    audioFile.transcription_formats !== undefined && 
    audioFile.transcription_formats !== null &&
    audioFile.transcription_formats.optimized !== undefined
  );
}

/**
 * Get all available transcription formats for an audio file
 * @param audioFile The audio file record
 * @returns Array of available transcription formats with service information
 */
export function getAvailableTranscriptionFormats(
  audioFile: AudioFile
): Array<TranscriptionFormat & { service: string }> {
  const formats: Array<TranscriptionFormat & { service: string }> = [];
  
  // Skip if no transcription formats available
  if (!audioFile.transcription_formats) {
    return formats;
  }
  
  // Add optimized format if available
  if (audioFile.transcription_formats.optimized) {
    formats.push({
      ...audioFile.transcription_formats.optimized,
      service: 'optimized'
    });
  }
  
  return formats;
}

/**
 * Get the best transcription format for an audio file
 * @param audioFile The audio file record
 * @returns The path to the best transcription format or the original file path if none available
 */
export function getBestTranscriptionFormat(
  audioFile: AudioFile
): string {
  // If optimized format is available, use it
  if (audioFile.transcription_formats?.optimized) {
    return audioFile.transcription_formats.optimized.path;
  }
  
  // Otherwise return the original file path
  return audioFile.file_path;
} 