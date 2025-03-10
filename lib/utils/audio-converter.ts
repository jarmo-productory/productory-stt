/**
 * Audio conversion utility for transcription optimization
 * 
 * This utility provides functions to convert audio files to formats optimized for transcription,
 * specifically 16kHz mono WAV which is the industry standard for speech recognition.
 */

import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Error class for audio conversion errors
 */
export class AudioConversionError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'AudioConversionError';
  }
}

/**
 * Options for audio conversion
 */
export interface AudioConversionOptions {
  sampleRate?: number;
  channels?: number;
  format?: string;
}

/**
 * Result of audio conversion
 */
export interface AudioConversionResult {
  outputPath: string;
  format: string;
  sampleRate: number;
  channels: number;
  success: boolean;
  error?: Error;
}

/**
 * Default options for transcription-optimized audio
 */
export const TRANSCRIPTION_AUDIO_DEFAULTS = {
  sampleRate: 16000,
  channels: 1,
  format: 'wav'
};

/**
 * Check if FFmpeg is available on the system
 * @returns Promise that resolves to true if FFmpeg is available, false otherwise
 */
export async function isFFmpegAvailable(): Promise<boolean> {
  try {
    await execPromise('ffmpeg -version');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Convert an audio file to a format optimized for transcription
 * @param inputPath Path to the input audio file
 * @param outputDir Directory where the output file will be saved
 * @param options Conversion options (defaults to 16kHz mono WAV)
 * @returns Promise that resolves to the conversion result
 */
export async function convertToTranscriptionFormat(
  inputPath: string,
  outputDir: string,
  options: AudioConversionOptions = {}
): Promise<AudioConversionResult> {
  // Merge options with defaults
  const settings = {
    ...TRANSCRIPTION_AUDIO_DEFAULTS,
    ...options
  };

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate output filename
  const inputFileName = path.basename(inputPath, path.extname(inputPath));
  const outputFileName = `${inputFileName}.${settings.format}`;
  const outputPath = path.join(outputDir, outputFileName);

  try {
    // Check if FFmpeg is available
    const ffmpegAvailable = await isFFmpegAvailable();
    if (!ffmpegAvailable) {
      throw new AudioConversionError('FFmpeg is not available on the system');
    }

    // Build FFmpeg command
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -vn -ar ${settings.sampleRate} -ac ${settings.channels} -c:a pcm_s16le "${outputPath}"`;
    
    // Execute FFmpeg command
    await execPromise(ffmpegCommand);

    // Return success result
    return {
      outputPath,
      format: settings.format,
      sampleRate: settings.sampleRate,
      channels: settings.channels,
      success: true
    };
  } catch (error) {
    // Handle errors
    const conversionError = new AudioConversionError(
      `Failed to convert audio file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );

    return {
      outputPath: '',
      format: settings.format,
      sampleRate: settings.sampleRate,
      channels: settings.channels,
      success: false,
      error: conversionError
    };
  }
}

/**
 * Convert an audio file to a format optimized for transcription with fallback to original
 * @param inputPath Path to the input audio file
 * @param outputDir Directory where the output file will be saved
 * @param options Conversion options (defaults to 16kHz mono WAV)
 * @returns Promise that resolves to the conversion result (original file path if conversion fails)
 */
export async function convertWithFallback(
  inputPath: string,
  outputDir: string,
  options: AudioConversionOptions = {}
): Promise<AudioConversionResult> {
  try {
    // Attempt conversion
    const result = await convertToTranscriptionFormat(inputPath, outputDir, options);
    
    // If conversion succeeded, return the result
    if (result.success) {
      return result;
    }
    
    // If conversion failed, log the error and fall back to the original file
    console.warn(`Audio conversion failed: ${result.error?.message}. Using original file.`);
    
    // Return result with original file path
    return {
      outputPath: inputPath,
      format: path.extname(inputPath).replace('.', ''),
      sampleRate: 0, // Unknown
      channels: 0, // Unknown
      success: true // Mark as success since we're using the original file as fallback
    };
  } catch (error) {
    // Handle any unexpected errors
    console.error('Unexpected error during audio conversion:', error);
    
    // Return result with original file path
    return {
      outputPath: inputPath,
      format: path.extname(inputPath).replace('.', ''),
      sampleRate: 0, // Unknown
      channels: 0, // Unknown
      success: true // Mark as success since we're using the original file as fallback
    };
  }
} 