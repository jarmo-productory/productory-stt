import { describe, it, expect, vi, beforeEach, 
  // @ts-ignore - May be used in future tests
  afterEach 
} from 'vitest';
import { 
  uploadFile, 
  downloadFile, 
  getFileUrl, 
  deleteFile,
  getStorageErrorMessage,
  fileExists,
  // @ts-ignore - Used for type checking but not directly referenced
  type StorageResult
} from './storage-helpers';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock the storagePathUtil - using string constants directly to avoid hoisting issues
vi.mock('./storage', () => {
  const MOCK_BUCKET_NAME = 'audio-files';
  
  return {
    storagePathUtil: {
      generateFormattedFilename: vi.fn().mockImplementation((filename) => `formatted_${filename}`),
      getAudioPath: vi.fn().mockImplementation((userId, fileName) => `audio/${userId}/${fileName}`),
      getPublicUrl: vi.fn().mockImplementation((path, bucket) => 
        `https://example.com/storage/v1/object/public/${bucket || MOCK_BUCKET_NAME}/${path}`),
      getDownloadUrl: vi.fn().mockImplementation((path, bucket) => 
        `https://example.com/storage/v1/object/download/${bucket || MOCK_BUCKET_NAME}/${path}`),
      isStandardPath: vi.fn().mockImplementation((path) => path.startsWith('audio/')),
      normalizePath: vi.fn().mockImplementation((path) => `audio/user-id/${path}`),
      getBucketConfig: vi.fn().mockReturnValue({
        defaultBucket: MOCK_BUCKET_NAME,
        audioPathPrefix: 'audio'
      }),
      withRetry: vi.fn().mockImplementation((fn) => fn()),
      getUserFriendlyErrorMessage: vi.fn().mockReturnValue('User-friendly error message')
    },
    StorageError: class StorageError extends Error {
      code: string;
      constructor(message: string, code: string) {
        super(message);
        this.name = 'StorageError';
        this.code = code;
      }
    }
  };
});

// Import the mocked module
import { storagePathUtil } from './storage';

// Type assertion for mocked functions
const mockedStoragePathUtil = storagePathUtil as unknown as {
  generateFormattedFilename: ReturnType<typeof vi.fn>;
  getAudioPath: ReturnType<typeof vi.fn>;
  getPublicUrl: ReturnType<typeof vi.fn>;
  getDownloadUrl: ReturnType<typeof vi.fn>;
  isStandardPath: ReturnType<typeof vi.fn>;
  normalizePath: ReturnType<typeof vi.fn>;
  getBucketConfig: ReturnType<typeof vi.fn>;
  withRetry: ReturnType<typeof vi.fn>;
  getUserFriendlyErrorMessage: ReturnType<typeof vi.fn>;
};

describe('storage-helpers', () => {
  // Mock variables for reuse
  const mockUserId = 'user-123';
  const mockFilePath = 'audio/user-123/test-file.mp3';
  const mockFile = new File(['test content'], 'test-file.mp3', { type: 'audio/mp3' });
  const mockBucketName = 'audio-files';
  
  // Create a mock for the Supabase client
  let mockSupabase: {
    storage: {
      from: ReturnType<typeof vi.fn>
    }
  };
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup the mock Supabase client with proper chaining
    mockSupabase = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ data: { path: mockFilePath }, error: null }),
          download: vi.fn().mockResolvedValue({ data: new Blob(['test']), error: null }),
          remove: vi.fn().mockResolvedValue({ data: {}, error: null }),
          list: vi.fn().mockResolvedValue({ 
            data: [{ name: 'test-file.mp3' }], 
            error: null 
          }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed-url.com' }, error: null })
        })
      }
    };
    
    // Reset the isStandardPath mock to return true for paths starting with 'audio/'
    mockedStoragePathUtil.isStandardPath.mockImplementation((path) => path.startsWith('audio/'));
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      // Execute
      const result = await uploadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFile,
        mockUserId
      );

      // Verify
      expect(storagePathUtil.generateFormattedFilename).toHaveBeenCalledWith(mockFile.name);
      expect(storagePathUtil.getAudioPath).toHaveBeenCalledWith(mockUserId, 'formatted_test-file.mp3');
      expect(mockSupabase.storage.from).toHaveBeenCalledWith(mockBucketName);
      expect(mockSupabase.storage.from().upload).toHaveBeenCalledWith(
        expect.any(String),
        mockFile,
        {
          cacheControl: '3600',
          upsert: false,
        }
      );
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should handle upload errors', async () => {
      // Setup
      const mockError = new Error('Upload failed');
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: mockError
      });

      // Execute
      const result = await uploadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFile,
        mockUserId
      );

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it('should use custom options when provided', async () => {
      // Execute
      const result = await uploadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFile,
        mockUserId,
        {
          cacheControl: '7200',
          upsert: true
        }
      );

      // Verify
      expect(mockSupabase.storage.from().upload).toHaveBeenCalledWith(
        expect.any(String),
        mockFile,
        {
          cacheControl: '7200',
          upsert: true,
        }
      );
      expect(result.success).toBe(true);
    });
  });

  describe('downloadFile', () => {
    it('should download a file successfully', async () => {
      // Setup
      const mockBlob = new Blob(['test content'], { type: 'audio/mp3' });
      mockSupabase.storage.from().download.mockResolvedValue({
        data: mockBlob,
        error: null
      });

      // Execute
      const result = await downloadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(mockFilePath);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith(mockBucketName);
      expect(mockSupabase.storage.from().download).toHaveBeenCalledWith(mockFilePath, {});
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data).toBe(mockBlob);
    });

    it('should normalize non-standard paths', async () => {
      // Setup
      const nonStandardPath = 'test-file.mp3';
      const normalizedPath = 'audio/user-id/test-file.mp3';
      const mockBlob = new Blob(['test content'], { type: 'audio/mp3' });
      
      mockedStoragePathUtil.isStandardPath.mockReturnValue(false);
      mockSupabase.storage.from().download.mockResolvedValue({
        data: mockBlob,
        error: null
      });

      // Execute
      const result = await downloadFile(
        mockSupabase as unknown as SupabaseClient,
        nonStandardPath
      );

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(nonStandardPath);
      expect(storagePathUtil.normalizePath).toHaveBeenCalledWith(nonStandardPath);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith(mockBucketName);
      expect(mockSupabase.storage.from().download).toHaveBeenCalledWith(normalizedPath, {});
      expect(result.success).toBe(true);
    });

    it('should handle download errors', async () => {
      // Setup
      const mockError = new Error('Download failed');
      mockSupabase.storage.from().download.mockResolvedValue({
        data: null,
        error: mockError
      });

      // Execute
      const result = await downloadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it('should use transform options when provided', async () => {
      // Setup
      const mockBlob = new Blob(['test content'], { type: 'audio/mp3' });
      mockSupabase.storage.from().download.mockResolvedValue({
        data: mockBlob,
        error: null
      });

      const transformOptions = {
        transform: {
          width: 100,
          height: 100,
          resize: 'cover' as const
        }
      };

      // Execute
      const result = await downloadFile(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath,
        transformOptions
      );

      // Verify
      // Use expect.any(String) to match any path string
      expect(mockSupabase.storage.from().download).toHaveBeenCalledWith(
        expect.any(String),
        transformOptions
      );
      expect(result.success).toBe(true);
    });
  });

  describe('getFileUrl', () => {
    it('should get a public URL for a file', () => {
      // Execute
      const result = getFileUrl(mockFilePath);

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(mockFilePath);
      // Use expect.any(String) to match any path string
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith(
        expect.any(String),
        undefined
      );
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should get a download URL when download option is true', () => {
      // Execute
      const result = getFileUrl(mockFilePath, { download: true });

      // Verify
      // Use expect.any(String) to match any path string
      expect(storagePathUtil.getDownloadUrl).toHaveBeenCalledWith(
        expect.any(String),
        undefined
      );
      expect(result.success).toBe(true);
    });

    it('should use custom bucket when provided', () => {
      // Execute
      const result = getFileUrl(mockFilePath, { bucket: 'custom-bucket' });

      // Verify
      // Use expect.any(String) to match any path string
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith(
        expect.any(String),
        'custom-bucket'
      );
      expect(result.success).toBe(true);
    });

    it('should normalize non-standard paths', () => {
      // Setup
      const nonStandardPath = 'test-file.mp3';
      const normalizedPath = 'audio/user-id/test-file.mp3';
      
      mockedStoragePathUtil.isStandardPath.mockReturnValue(false);

      // Execute
      const result = getFileUrl(nonStandardPath);

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(nonStandardPath);
      expect(storagePathUtil.normalizePath).toHaveBeenCalledWith(nonStandardPath);
      expect(storagePathUtil.getPublicUrl).toHaveBeenCalledWith(normalizedPath, undefined);
      expect(result.success).toBe(true);
    });

    it('should handle errors', () => {
      // Setup
      mockedStoragePathUtil.getPublicUrl.mockImplementation(() => {
        throw new Error('URL generation failed');
      });

      // Execute
      const result = getFileUrl(mockFilePath);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      if (result.error) {
        expect(result.error.message).toBe('URL generation failed');
      }
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      // Execute
      const result = await deleteFile(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(mockFilePath);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith(mockBucketName);
      // Use expect.any(Array) to match any array of paths
      expect(mockSupabase.storage.from().remove).toHaveBeenCalledWith(
        expect.any(Array)
      );
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should normalize non-standard paths', async () => {
      // Setup
      const nonStandardPath = 'test-file.mp3';
      const normalizedPath = 'audio/user-id/test-file.mp3';
      
      mockedStoragePathUtil.isStandardPath.mockReturnValue(false);

      // Execute
      const result = await deleteFile(
        mockSupabase as unknown as SupabaseClient,
        nonStandardPath
      );

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(nonStandardPath);
      expect(storagePathUtil.normalizePath).toHaveBeenCalledWith(nonStandardPath);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith(mockBucketName);
      expect(mockSupabase.storage.from().remove).toHaveBeenCalledWith([normalizedPath]);
      expect(result.success).toBe(true);
    });

    it('should handle delete errors', async () => {
      // Setup
      const mockError = new Error('Delete failed');
      mockSupabase.storage.from().remove.mockResolvedValue({
        data: null,
        error: mockError
      });

      // Execute
      const result = await deleteFile(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('getStorageErrorMessage', () => {
    it('should get a user-friendly error message', () => {
      // Setup
      const mockError = new Error('Storage error');

      // Execute
      const result = getStorageErrorMessage(mockError);

      // Verify
      expect(storagePathUtil.getUserFriendlyErrorMessage).toHaveBeenCalledWith(mockError);
      expect(result).toEqual('User-friendly error message');
    });
  });

  describe('fileExists', () => {
    it('should check if a file exists successfully', async () => {
      // Setup
      mockSupabase.storage.from().list.mockResolvedValue({
        data: [{ name: 'test-file.mp3' }],
        error: null
      });

      // Execute
      const result = await fileExists(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(storagePathUtil.isStandardPath).toHaveBeenCalledWith(mockFilePath);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith(mockBucketName);
      expect(mockSupabase.storage.from().list).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      // Setup
      mockSupabase.storage.from().list.mockResolvedValue({
        data: [{ name: 'other-file.mp3' }],
        error: null
      });

      // Execute
      const result = await fileExists(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('should handle list errors', async () => {
      // Setup
      const mockError = new Error('List failed');
      mockSupabase.storage.from().list.mockResolvedValue({
        data: null,
        error: mockError
      });

      // Execute
      const result = await fileExists(
        mockSupabase as unknown as SupabaseClient,
        mockFilePath
      );

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
      expect(result.data).toBe(false);
    });
  });
}); 