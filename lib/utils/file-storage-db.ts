/**
 * Utilities for working with the enhanced database schema for file storage
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { storagePathUtil } from './storage';

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