/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createAudioFile, 
  getAudioFile, 
  getAudioFilePath, 
  getAudioFileUrl, 
  updateAudioFile, 
  deleteAudioFile, 
  listAudioFiles, 
  searchAudioFiles,
  type AudioFile,
  addTranscriptionFormat,
  getBestTranscriptionFormat,
  getAvailableTranscriptionFormats
} from './file-storage-db';
import { storagePathUtil } from './storage';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock the Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
};

// Mock the storagePathUtil
vi.mock('./storage', () => ({
  storagePathUtil: {
    getAudioPath: vi.fn().mockImplementation((userId: string, fileName: string) => `audio/${userId}/${fileName}`),
    getPublicUrl: vi.fn().mockImplementation((path: string, bucket: string) => `https://example.com/${bucket}/${path}`),
    getBucketConfig: vi.fn().mockReturnValue({
      defaultBucket: 'audio-files',
      audioPathPrefix: 'audio'
    })
  }
}));

describe('file-storage-db', () => {
  const mockUserId = 'user-123';
  const mockFileId = 'file-123';
  const mockFileName = 'test-file.mp3';
  const mockFilePath = `audio/${mockUserId}/${mockFileName}`;
  
  const mockAudioFile: AudioFile = {
    id: mockFileId,
    user_id: mockUserId,
    file_name: mockFileName,
    file_path: mockFilePath,
    normalized_path: `audio/${mockUserId}/${mockFileName}`,
    bucket_name: 'audio-files',
    storage_prefix: 'audio',
    format: 'mp3',
    size: 1024,
    status: 'ready',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z',
    folder_id: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createAudioFile', () => {
    it('should create an audio file record', async () => {
      // Setup
      mockSupabase.insert.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: mockAudioFile,
        error: null
      });

      // Execute
      const result = await createAudioFile(mockSupabase as unknown as SupabaseClient, {
        userId: mockUserId,
        fileName: mockFileName,
        filePath: mockFilePath,
        format: 'mp3',
        size: 1024
      });

      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: mockUserId,
        file_name: mockFileName,
        file_path: mockFilePath,
        bucket_name: 'audio-files',
        storage_prefix: 'audio',
        format: 'mp3',
        size: 1024
      }));
      expect(result).toEqual(mockAudioFile);
    });

    it('should handle errors when creating an audio file record', async () => {
      // Setup
      mockSupabase.insert.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      // Execute
      const result = await createAudioFile(mockSupabase as unknown as SupabaseClient, {
        userId: mockUserId,
        fileName: mockFileName,
        filePath: mockFilePath
      });

      // Verify
      expect(result).toBeNull();
    });
  });

  describe('getAudioFile', () => {
    it('should get an audio file record by ID', async () => {
      // Setup
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: mockAudioFile,
        error: null
      });

      // Execute
      const result = await getAudioFile(mockSupabase as unknown as SupabaseClient, mockFileId);

      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockFileId);
      expect(result).toEqual(mockAudioFile);
    });

    it('should handle errors when getting an audio file record', async () => {
      // Setup
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      // Execute
      const result = await getAudioFile(mockSupabase as unknown as SupabaseClient, mockFileId);

      // Verify
      expect(result).toBeNull();
    });
  });

  describe('getAudioFilePath', () => {
    it('should return normalized_path if available', () => {
      // Execute
      const result = getAudioFilePath(mockAudioFile);

      // Verify
      expect(result).toEqual(mockAudioFile.normalized_path);
    });

    it('should construct path using StoragePathUtil if normalized_path is not available', () => {
      // Setup
      const fileWithoutNormalizedPath = { ...mockAudioFile, normalized_path: undefined };

      // Execute
      const result = getAudioFilePath(fileWithoutNormalizedPath);

      // Verify
      expect(storagePathUtil.getAudioPath).toHaveBeenCalledWith(mockUserId, mockFileName);
      expect(result).toEqual(`audio/${mockUserId}/${mockFileName}`);
    });
  });

  describe('getAudioFileUrl', () => {
    it('should return public URL using normalized_path if available', () => {
      // Execute
      const result = getAudioFileUrl(mockAudioFile);

      // Verify
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith(
        mockAudioFile.normalized_path,
        mockAudioFile.bucket_name
      );
      expect(result).toEqual(`https://example.com/${mockAudioFile.bucket_name}/${mockAudioFile.normalized_path}`);
    });

    it('should construct URL using StoragePathUtil if normalized_path is not available', () => {
      // Setup
      const fileWithoutNormalizedPath = { 
        ...mockAudioFile, 
        normalized_path: undefined,
        bucket_name: undefined
      };

      // Execute
      const result = getAudioFileUrl(fileWithoutNormalizedPath);

      // Verify
      expect(storagePathUtil.getAudioPath).toHaveBeenCalledWith(mockUserId, mockFileName);
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith(
        `audio/${mockUserId}/${mockFileName}`,
        'audio-files'
      );
      expect(result).toEqual(`https://example.com/audio-files/audio/${mockUserId}/${mockFileName}`);
    });
  });

  describe('updateAudioFile', () => {
    it('should update an audio file record', async () => {
      // Setup
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: { ...mockAudioFile, file_name: 'updated-file.mp3' },
        error: null
      });

      // Execute
      const result = await updateAudioFile(mockSupabase as unknown as SupabaseClient, mockFileId, {
        file_name: 'updated-file.mp3'
      });

      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        file_name: 'updated-file.mp3'
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockFileId);
      expect(result).toEqual({ ...mockAudioFile, file_name: 'updated-file.mp3' });
    });

    it('should handle errors when updating an audio file record', async () => {
      // Setup
      mockSupabase.update.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      // Execute
      const result = await updateAudioFile(mockSupabase as unknown as SupabaseClient, mockFileId, {
        file_name: 'updated-file.mp3'
      });

      // Verify
      expect(result).toBeNull();
    });
  });

  describe('deleteAudioFile', () => {
    it('should delete an audio file record', async () => {
      // Setup
      mockSupabase.delete.mockReturnThis();
      mockSupabase.eq.mockResolvedValue({
        error: null
      });

      // Execute
      const result = await deleteAudioFile(mockSupabase as unknown as SupabaseClient, mockFileId);

      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockFileId);
      expect(result).toBe(true);
    });

    it('should handle errors when deleting an audio file record', async () => {
      // Setup
      mockSupabase.delete.mockReturnThis();
      mockSupabase.eq.mockResolvedValue({
        error: new Error('Database error')
      });

      // Execute
      const result = await deleteAudioFile(mockSupabase as unknown as SupabaseClient, mockFileId);

      // Verify
      expect(result).toBe(false);
    });
  });

  describe('listAudioFiles', () => {
    it('should list audio files for a user', async () => {
      // Setup
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.limit.mockReturnThis();
      mockSupabase.range.mockResolvedValue({
        data: [mockAudioFile],
        error: null
      });

      // Execute
      const result = await listAudioFiles(mockSupabase as unknown as SupabaseClient, mockUserId);

      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockSupabase.limit).toHaveBeenCalledWith(100);
      expect(mockSupabase.range).toHaveBeenCalledWith(0, 99);
      expect(result).toEqual([mockAudioFile]);
    });

    it('should filter by folder ID when specified', async () => {
      // Setup
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.limit.mockReturnThis();
      mockSupabase.range.mockResolvedValue({
        data: [mockAudioFile],
        error: null
      });

      // Execute
      const result = await listAudioFiles(mockSupabase as unknown as SupabaseClient, mockUserId, {
        folderId: 'folder-123'
      });

      // Verify
      expect(mockSupabase.eq).toHaveBeenCalledWith('folder_id', 'folder-123');
      expect(result).toEqual([mockAudioFile]);
    });

    it('should handle errors when listing audio files', async () => {
      // Setup
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.limit.mockReturnThis();
      mockSupabase.range.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      // Execute
      const result = await listAudioFiles(mockSupabase as unknown as SupabaseClient, mockUserId);

      // Verify
      expect(result).toEqual([]);
    });
  });

  describe('searchAudioFiles', () => {
    it('should search audio files for a user', async () => {
      // Setup
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.ilike.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.limit.mockReturnThis();
      mockSupabase.range.mockResolvedValue({
        data: [mockAudioFile],
        error: null
      });

      // Execute
      const result = await searchAudioFiles(mockSupabase as unknown as SupabaseClient, mockUserId, 'test');

      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockSupabase.ilike).toHaveBeenCalledWith('file_name', '%test%');
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockSupabase.limit).toHaveBeenCalledWith(100);
      expect(mockSupabase.range).toHaveBeenCalledWith(0, 99);
      expect(result).toEqual([mockAudioFile]);
    });

    it('should filter by folder ID when specified', async () => {
      // Setup
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.ilike.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.limit.mockReturnThis();
      mockSupabase.range.mockResolvedValue({
        data: [mockAudioFile],
        error: null
      });

      // Execute
      const result = await searchAudioFiles(mockSupabase as unknown as SupabaseClient, mockUserId, 'test', {
        folderId: 'folder-123'
      });

      // Verify
      expect(mockSupabase.eq).toHaveBeenCalledWith('folder_id', 'folder-123');
      expect(result).toEqual([mockAudioFile]);
    });

    it('should handle errors when searching audio files', async () => {
      // Setup
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.ilike.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.limit.mockReturnThis();
      mockSupabase.range.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      // Execute
      const result = await searchAudioFiles(mockSupabase as unknown as SupabaseClient, mockUserId, 'test');

      // Verify
      expect(result).toEqual([]);
    });
  });

  // Add tests for transcription format functions
  describe('Transcription Format Functions', () => {
    // Test for addTranscriptionFormat
    describe('addTranscriptionFormat', () => {
      it('should add a new transcription format to an audio file', async () => {
        // Mock existing file with no transcription formats
        mockSupabase.from.mockReturnValue({
          select: mockSupabase.select,
          eq: mockSupabase.eq,
          single: mockSupabase.single,
        });
        mockSupabase.select.mockReturnValue({
          eq: mockSupabase.eq,
        });
        mockSupabase.eq.mockReturnValue({
          single: mockSupabase.single,
        });
        mockSupabase.single.mockResolvedValueOnce({
          data: { transcription_formats: {} },
          error: null,
        });

        // Mock update operation
        mockSupabase.from.mockReturnValue({
          update: mockSupabase.update,
        });
        mockSupabase.update.mockReturnValue({
          eq: mockSupabase.eq,
        });
        mockSupabase.eq.mockReturnValue({
          select: mockSupabase.select,
        });
        mockSupabase.select.mockReturnValue({
          single: mockSupabase.single,
        });
        mockSupabase.single.mockResolvedValueOnce({
          data: {
            id: mockFileId,
            transcription_formats: {
              whisper: {
                path: 'audio/user-id/transcription/file.wav',
                format: 'wav',
                sample_rate: 16000,
                channels: 1,
                created_at: '2023-06-15T14:30:00Z',
              },
            },
          },
          error: null,
        });

        // Call the function
        const formatInfo = {
          path: 'audio/user-id/transcription/file.wav',
          format: 'wav',
          sample_rate: 16000,
          channels: 1,
        };
        
        const result = await addTranscriptionFormat(
          mockSupabase as unknown as SupabaseClient,
          mockFileId,
          'whisper',
          formatInfo
        );

        // Verify the result
        expect(result).not.toBeNull();
        expect(result?.transcription_formats?.whisper).toBeDefined();
        expect(result?.transcription_formats?.whisper.format).toBe('wav');
        expect(result?.transcription_formats?.whisper.sample_rate).toBe(16000);
      });

      it('should handle errors when fetching the audio file', async () => {
        // Mock error when fetching file
        mockSupabase.from.mockReturnValue({
          select: mockSupabase.select,
          eq: mockSupabase.eq,
          single: mockSupabase.single,
        });
        mockSupabase.select.mockReturnValue({
          eq: mockSupabase.eq,
        });
        mockSupabase.eq.mockReturnValue({
          single: mockSupabase.single,
        });
        mockSupabase.single.mockResolvedValueOnce({
          data: null,
          error: new Error('File not found'),
        });

        // Call the function
        const formatInfo = {
          path: 'audio/user-id/transcription/file.wav',
          format: 'wav',
          sample_rate: 16000,
          channels: 1,
        };
        
        const result = await addTranscriptionFormat(
          mockSupabase as unknown as SupabaseClient,
          mockFileId,
          'whisper',
          formatInfo
        );

        // Verify the result
        expect(result).toBeNull();
      });
    });

    // Test for getBestTranscriptionFormat
    describe('getBestTranscriptionFormat', () => {
      it('should return the preferred service format if available', () => {
        const audioFile: AudioFile = {
          id: mockFileId,
          user_id: mockUserId,
          file_name: 'test.mp3',
          file_path: 'original/path/test.mp3',
          transcription_formats: {
            whisper: {
              path: 'audio/user-id/transcription/whisper.wav',
              format: 'wav',
              sample_rate: 16000,
              channels: 1,
              created_at: '2023-06-15T14:30:00Z',
            },
            google: {
              path: 'audio/user-id/transcription/google.flac',
              format: 'flac',
              sample_rate: 44100,
              channels: 2,
              created_at: '2023-06-15T14:35:00Z',
            },
          },
        };

        const result = getBestTranscriptionFormat(audioFile, 'google');
        expect(result).toBe('audio/user-id/transcription/google.flac');
      });

      it('should return the whisper format if preferred service is not available', () => {
        const audioFile: AudioFile = {
          id: mockFileId,
          user_id: mockUserId,
          file_name: 'test.mp3',
          file_path: 'original/path/test.mp3',
          transcription_formats: {
            whisper: {
              path: 'audio/user-id/transcription/whisper.wav',
              format: 'wav',
              sample_rate: 16000,
              channels: 1,
              created_at: '2023-06-15T14:30:00Z',
            },
          },
        };

        const result = getBestTranscriptionFormat(audioFile, 'google');
        expect(result).toBe('audio/user-id/transcription/whisper.wav');
      });

      it('should return the original file path if no transcription formats are available', () => {
        const audioFile: AudioFile = {
          id: mockFileId,
          user_id: mockUserId,
          file_name: 'test.mp3',
          file_path: 'original/path/test.mp3',
        };

        const result = getBestTranscriptionFormat(audioFile);
        expect(result).toBe('original/path/test.mp3');
      });
    });

    // Test for getAvailableTranscriptionFormats
    describe('getAvailableTranscriptionFormats', () => {
      it('should return all available transcription formats', () => {
        const audioFile: AudioFile = {
          id: mockFileId,
          user_id: mockUserId,
          file_name: 'test.mp3',
          file_path: 'original/path/test.mp3',
          transcription_formats: {
            whisper: {
              path: 'audio/user-id/transcription/whisper.wav',
              format: 'wav',
              sample_rate: 16000,
              channels: 1,
              created_at: '2023-06-15T14:30:00Z',
            },
            google: {
              path: 'audio/user-id/transcription/google.flac',
              format: 'flac',
              sample_rate: 44100,
              channels: 2,
              created_at: '2023-06-15T14:35:00Z',
            },
          },
        };

        const result = getAvailableTranscriptionFormats(audioFile);
        expect(result).toHaveLength(2);
        expect(result[0].service).toBe('whisper');
        expect(result[1].service).toBe('google');
      });

      it('should return an empty array if no transcription formats are available', () => {
        const audioFile: AudioFile = {
          id: mockFileId,
          user_id: mockUserId,
          file_name: 'test.mp3',
          file_path: 'original/path/test.mp3',
        };

        const result = getAvailableTranscriptionFormats(audioFile);
        expect(result).toHaveLength(0);
      });
    });
  });
}); 