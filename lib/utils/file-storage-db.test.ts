/// <reference types="vitest" />
// We need to mock the module before any imports
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock the storage module before any imports
vi.mock('./storage', () => {
  // Create mock functions that will be spied on
  const getAudioPath = vi.fn().mockReturnValue('audio/user-123/test-file.mp3');
  const getPublicUrl = vi.fn().mockReturnValue('https://example.com/audio-files/audio/user-123/test-file.mp3');
  const getBucketConfig = vi.fn().mockReturnValue({
    defaultBucket: 'audio-files',
    audioPathPrefix: 'audio',
    baseUrl: 'https://example.com'
  });

  return {
    storagePathUtil: {
      getAudioPath,
      getPublicUrl,
      getBucketConfig
    }
  };
});

// Now import the modules that depend on the mocked module
import { 
  createAudioFile, 
  getAudioFile, 
  getAudioFilePath, 
  getAudioFileUrl, 
  updateAudioFile, 
  deleteAudioFile, 
  listAudioFiles, 
  searchAudioFiles,
  // @ts-ignore - This type is used for type checking but not directly referenced
  type AudioFile,
  addTranscriptionFormat,
  getBestTranscriptionFormat,
  getAvailableTranscriptionFormats
} from './file-storage-db';
import { storagePathUtil } from './storage';

// Define a type for our mock Supabase instance
type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
  _response: { data: any; error: Error | null };
  _reset: () => void;
};

// Simplified mock setup - create a single comprehensive mock object
const createMockSupabase = (): MockSupabase => {
  // Create mock response object that can be customized per test
  const mockResponse = { data: null, error: null };
  
  // Create a chainable mock with consistent structure
  const mockChain = {
    select: vi.fn(() => mockChain),
    insert: vi.fn(() => mockChain),
    update: vi.fn(() => mockChain),
    delete: vi.fn(() => mockChain),
    eq: vi.fn(() => mockChain),
    ilike: vi.fn(() => mockChain),
    order: vi.fn(() => mockChain),
    limit: vi.fn(() => mockChain),
    range: vi.fn(() => mockChain),
    single: vi.fn(() => Promise.resolve(mockResponse)),
    then: vi.fn((callback) => Promise.resolve(callback(mockResponse))),
  };
  
  // Main Supabase mock
  const mockSupabase = {
    from: vi.fn(() => mockChain),
    // Reference the mockResponse so tests can set expected data/errors
    _response: mockResponse,
    // Reset the response to default values
    _reset: () => {
      mockResponse.data = null;
      mockResponse.error = null;
    }
  };
  
  return mockSupabase;
};

describe('file-storage-db', () => {
  const mockUserId = 'user-123';
  const mockFileId = 'file-123';
  const mockFileName = 'test-file.mp3';
  const mockFilePath = `audio/${mockUserId}/${mockFileName}`;
  
  const mockAudioFile = {
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

  let mockSupabase: MockSupabase;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    vi.clearAllMocks();
    // Ensure the mock functions return the expected values
    vi.mocked(storagePathUtil.getAudioPath).mockReturnValue('audio/user-123/test-file.mp3');
    vi.mocked(storagePathUtil.getPublicUrl).mockReturnValue('https://example.com/audio-files/audio/user-123/test-file.mp3');
    vi.mocked(storagePathUtil.getBucketConfig).mockReturnValue({
      defaultBucket: 'audio-files',
      audioPathPrefix: 'audio',
      baseUrl: 'https://example.com'
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createAudioFile', () => {
    it('should create an audio file record', async () => {
      // Setup
      mockSupabase._response.data = mockAudioFile;

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
      expect(result).toEqual(mockAudioFile);
    });

    it('should handle errors when creating an audio file record', async () => {
      // Setup
      mockSupabase._response.error = new Error('Database error');

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
      mockSupabase._response.data = mockAudioFile;

      // Execute
      const result = await getAudioFile(mockSupabase as unknown as SupabaseClient, mockFileId);

      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(result).toEqual(mockAudioFile);
    });

    it('should handle errors when getting an audio file record', async () => {
      // Setup
      mockSupabase._response.error = new Error('Database error');

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
      expect(result).toBe('audio/user-123/test-file.mp3');
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
      expect(result).toBe('https://example.com/audio-files/audio/user-123/test-file.mp3');
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
        'audio/user-123/test-file.mp3',
        'audio-files'
      );
      expect(result).toBe('https://example.com/audio-files/audio/user-123/test-file.mp3');
    });
  });

  describe('updateAudioFile', () => {
    it('should update an audio file record', async () => {
      // Setup
      const updatedFile = { ...mockAudioFile, file_name: 'updated-file.mp3' };
      mockSupabase._response.data = updatedFile;

      // Execute
      const result = await updateAudioFile(mockSupabase as unknown as SupabaseClient, mockFileId, {
        file_name: 'updated-file.mp3'
      });

      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(result).toEqual(updatedFile);
    });

    it('should handle errors when updating an audio file record', async () => {
      // Setup
      mockSupabase._response.error = new Error('Database error');

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
      mockSupabase._response.error = null;

      // Execute
      const result = await deleteAudioFile(mockSupabase as unknown as SupabaseClient, mockFileId);

      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(result).toBe(true);
    });

    it('should handle errors when deleting an audio file record', async () => {
      // Setup
      mockSupabase._response.error = new Error('Database error');

      // Execute
      const result = await deleteAudioFile(mockSupabase as unknown as SupabaseClient, mockFileId);

      // Verify
      expect(result).toBe(false);
    });
  });

  describe('listAudioFiles', () => {
    it('should list audio files for a user', async () => {
      // Setup
      mockSupabase._response.data = [mockAudioFile];
      
      // Call the function
      const result = await listAudioFiles(
        mockSupabase as unknown as SupabaseClient, 
        mockUserId
      );
      
      // Verify the result
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(result).toEqual([mockAudioFile]);
    });
    
    it('should handle errors when listing audio files', async () => {
      // Setup
      mockSupabase._response.error = new Error('Database error');
      
      // Call the function
      const result = await listAudioFiles(
        mockSupabase as unknown as SupabaseClient, 
        mockUserId
      );
      
      // Empty array should be returned on error
      expect(result).toEqual([]);
    });
  });

  describe('searchAudioFiles', () => {
    it('should search audio files for a user', async () => {
      // Setup
      mockSupabase._response.data = [mockAudioFile];
      
      // Call the function
      const result = await searchAudioFiles(
        mockSupabase as unknown as SupabaseClient, 
        mockUserId,
        'test'
      );
      
      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(result).toEqual([mockAudioFile]);
    });

    it('should filter by folder ID when specified', async () => {
      // Setup
      mockSupabase._response.data = [mockAudioFile];
      
      // Call the function
      const result = await searchAudioFiles(
        mockSupabase as unknown as SupabaseClient, 
        mockUserId,
        'test',
        { folderId: 'folder-123' }
      );
      
      // Verify
      expect(mockSupabase.from).toHaveBeenCalledWith('audio_files');
      expect(result).toEqual([mockAudioFile]);
    });

    it('should handle errors when searching audio files', async () => {
      // Setup
      mockSupabase._response.error = new Error('Database error');
      
      // Call the function
      const result = await searchAudioFiles(
        mockSupabase as unknown as SupabaseClient, 
        mockUserId,
        'test'
      );
      
      // Empty array should be returned on error
      expect(result).toEqual([]);
    });
  });

  // Add tests for transcription format functions
  describe('Transcription Format Functions', () => {
    // Test for addTranscriptionFormat
    describe('addTranscriptionFormat', () => {
      it('should add a new transcription format to an audio file', async () => {
        // Setup
        const formatInfo = {
          path: 'audio/user-id/transcription/file.wav',
          format: 'wav',
          sample_rate: 16000,
          channels: 1
        };

        const updatedFile = {
          id: mockFileId,
          user_id: mockUserId,
          file_name: 'test.mp3',
          file_path: 'path/to/file.mp3',
          transcription_formats: {
            optimized: {
              path: 'audio/user-id/transcription/file.wav',
              format: 'wav',
              sample_rate: 16000,
              channels: 1,
              created_at: '2023-01-01T00:00:00Z'
            }
          }
        };

        // Setup the mock response directly
        mockSupabase._response.data = { id: mockFileId, transcription_formats: {} };
        mockSupabase._response.error = null;

        // For the second call (update), set up a different response
        const originalSelect = mockSupabase.from().select;
        const originalUpdate = mockSupabase.from().update;
        
        // Override select to return the initial file first
        mockSupabase.from().select = vi.fn().mockImplementation(() => {
          return {
            ...mockSupabase.from(),
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ 
                data: { id: mockFileId, transcription_formats: {} }, 
                error: null 
              })
            })
          };
        });
        
        // Override update to return the updated file
        mockSupabase.from().update = vi.fn().mockImplementation(() => {
          return {
            ...mockSupabase.from(),
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: updatedFile, 
                  error: null 
                })
              })
            })
          };
        });

        // Execute
        const result = await addTranscriptionFormat(
          mockSupabase as unknown as SupabaseClient,
          mockFileId,
          formatInfo
        );

        // Restore original implementations
        mockSupabase.from().select = originalSelect;
        mockSupabase.from().update = originalUpdate;

        // Verify
        expect(result).not.toBeNull();
        expect(result?.transcription_formats?.optimized?.format).toBe('wav');
        expect(result?.transcription_formats?.optimized?.sample_rate).toBe(16000);
      });

      it('should handle errors when fetching the audio file', async () => {
        // Setup error when fetching file
        mockSupabase._response.error = new Error('File not found');
        
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
          formatInfo
        );

        // Verify the result
        expect(result).toBeNull();
      });
    });

    // Test for getBestTranscriptionFormat
    describe('getBestTranscriptionFormat', () => {
      it('should return the optimized format path if available', () => {
        const audioFile = {
          id: mockFileId,
          user_id: mockUserId,
          file_name: 'test.mp3',
          file_path: 'original/path/test.mp3',
          transcription_formats: {
            optimized: {
              path: 'audio/user-id/transcription/optimized.wav',
              format: 'wav',
              sample_rate: 16000,
              channels: 1,
              created_at: '2023-06-15T14:30:00Z',
            }
          },
        };

        const result = getBestTranscriptionFormat(audioFile);
        expect(result).toBe('audio/user-id/transcription/optimized.wav');
      });

      it('should return the original file path if no transcription formats are available', () => {
        const audioFile = {
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
      it('should return available optimized transcription format', () => {
        const audioFile = {
          id: mockFileId,
          user_id: mockUserId,
          file_name: 'test.mp3',
          file_path: 'original/path/test.mp3',
          transcription_formats: {
            optimized: {
              path: 'audio/user-id/transcription/optimized.wav',
              format: 'wav',
              sample_rate: 16000,
              channels: 1,
              created_at: '2023-06-15T14:30:00Z',
            }
          },
        };

        const result = getAvailableTranscriptionFormats(audioFile);
        expect(result).toHaveLength(1);
        expect(result[0].service).toBe('optimized');
        expect(result[0].path).toBe('audio/user-id/transcription/optimized.wav');
      });

      it('should return an empty array if no transcription formats are available', () => {
        const audioFile = {
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