import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import {
  isFFmpegAvailable,
  convertToTranscriptionFormat,
  convertWithFallback,
  AudioConversionError,
  TRANSCRIPTION_AUDIO_DEFAULTS
} from './audio-converter';

// Mock the child_process and fs modules
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn()
}));

describe('Audio Converter', () => {
  // Setup mocks
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Mock exec to return a promise
    (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((command, callback) => {
      callback(null, { stdout: 'success', stderr: '' });
      return { stdout: 'success', stderr: '' };
    });
    
    // Mock fs.existsSync to return true
    (fs.existsSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('isFFmpegAvailable', () => {
    it('should return true if FFmpeg is available', async () => {
      const result = await isFFmpegAvailable();
      expect(result).toBe(true);
      expect(exec).toHaveBeenCalledWith('ffmpeg -version', expect.any(Function));
    });
    
    it('should return false if FFmpeg is not available', async () => {
      (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((command, callback) => {
        callback(new Error('Command not found'), { stdout: '', stderr: 'Command not found' });
        return { stdout: '', stderr: 'Command not found' };
      });
      
      const result = await isFFmpegAvailable();
      expect(result).toBe(false);
      expect(exec).toHaveBeenCalledWith('ffmpeg -version', expect.any(Function));
    });
  });
  
  describe('convertToTranscriptionFormat', () => {
    it('should convert an audio file to the transcription format', async () => {
      const inputPath = '/path/to/input.mp3';
      const outputDir = '/path/to/output';
      
      const result = await convertToTranscriptionFormat(inputPath, outputDir);
      
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe('/path/to/output/input.wav');
      expect(result.format).toBe(TRANSCRIPTION_AUDIO_DEFAULTS.format);
      expect(result.sampleRate).toBe(TRANSCRIPTION_AUDIO_DEFAULTS.sampleRate);
      expect(result.channels).toBe(TRANSCRIPTION_AUDIO_DEFAULTS.channels);
      
      // Check if FFmpeg command was called with correct parameters
      const expectedCommand = `ffmpeg -i "${inputPath}" -vn -ar ${TRANSCRIPTION_AUDIO_DEFAULTS.sampleRate} -ac ${TRANSCRIPTION_AUDIO_DEFAULTS.channels} -c:a pcm_s16le "/path/to/output/input.wav"`;
      expect(exec).toHaveBeenCalledWith(expectedCommand, expect.any(Function));
    });
    
    it('should create the output directory if it does not exist', async () => {
      (fs.existsSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
      
      const inputPath = '/path/to/input.mp3';
      const outputDir = '/path/to/output';
      
      await convertToTranscriptionFormat(inputPath, outputDir);
      
      expect(fs.existsSync).toHaveBeenCalledWith(outputDir);
      expect(fs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
    });
    
    it('should handle FFmpeg errors', async () => {
      (exec as unknown as ReturnType<typeof vi.fn>).mockImplementation((command, callback) => {
        callback(new Error('FFmpeg error'), { stdout: '', stderr: 'FFmpeg error' });
        return { stdout: '', stderr: 'FFmpeg error' };
      });
      
      const inputPath = '/path/to/input.mp3';
      const outputDir = '/path/to/output';
      
      const result = await convertToTranscriptionFormat(inputPath, outputDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AudioConversionError);
      expect(result.error?.message).toContain('Failed to convert audio file');
    });
    
    it('should handle FFmpeg unavailability', async () => {
      // Mock isFFmpegAvailable to return false
      vi.spyOn(global, 'isFFmpegAvailable' as any).mockResolvedValue(false);
      
      const inputPath = '/path/to/input.mp3';
      const outputDir = '/path/to/output';
      
      const result = await convertToTranscriptionFormat(inputPath, outputDir);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AudioConversionError);
      expect(result.error?.message).toBe('FFmpeg is not available on the system');
    });
    
    it('should use custom options if provided', async () => {
      const inputPath = '/path/to/input.mp3';
      const outputDir = '/path/to/output';
      const options = {
        sampleRate: 44100,
        channels: 2,
        format: 'flac'
      };
      
      const result = await convertToTranscriptionFormat(inputPath, outputDir, options);
      
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe('/path/to/output/input.flac');
      expect(result.format).toBe(options.format);
      expect(result.sampleRate).toBe(options.sampleRate);
      expect(result.channels).toBe(options.channels);
      
      // Check if FFmpeg command was called with correct parameters
      const expectedCommand = `ffmpeg -i "${inputPath}" -vn -ar ${options.sampleRate} -ac ${options.channels} -c:a pcm_s16le "/path/to/output/input.flac"`;
      expect(exec).toHaveBeenCalledWith(expectedCommand, expect.any(Function));
    });
  });
  
  describe('convertWithFallback', () => {
    it('should return the converted file if conversion succeeds', async () => {
      const inputPath = '/path/to/input.mp3';
      const outputDir = '/path/to/output';
      
      // Mock convertToTranscriptionFormat to return success
      vi.spyOn(global, 'convertToTranscriptionFormat' as any).mockResolvedValue({
        outputPath: '/path/to/output/input.wav',
        format: 'wav',
        sampleRate: 16000,
        channels: 1,
        success: true
      });
      
      const result = await convertWithFallback(inputPath, outputDir);
      
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe('/path/to/output/input.wav');
    });
    
    it('should fall back to the original file if conversion fails', async () => {
      const inputPath = '/path/to/input.mp3';
      const outputDir = '/path/to/output';
      
      // Mock convertToTranscriptionFormat to return failure
      vi.spyOn(global, 'convertToTranscriptionFormat' as any).mockResolvedValue({
        outputPath: '',
        format: 'wav',
        sampleRate: 16000,
        channels: 1,
        success: false,
        error: new AudioConversionError('Conversion failed')
      });
      
      const result = await convertWithFallback(inputPath, outputDir);
      
      expect(result.success).toBe(true); // Should be true because we're using the original file
      expect(result.outputPath).toBe(inputPath);
      expect(result.format).toBe('mp3');
    });
    
    it('should handle unexpected errors', async () => {
      const inputPath = '/path/to/input.mp3';
      const outputDir = '/path/to/output';
      
      // Mock convertToTranscriptionFormat to throw an error
      vi.spyOn(global, 'convertToTranscriptionFormat' as any).mockRejectedValue(new Error('Unexpected error'));
      
      const result = await convertWithFallback(inputPath, outputDir);
      
      expect(result.success).toBe(true); // Should be true because we're using the original file
      expect(result.outputPath).toBe(inputPath);
      expect(result.format).toBe('mp3');
    });
  });
}); 