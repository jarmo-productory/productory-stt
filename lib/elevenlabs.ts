import { ElevenLabsClient } from 'elevenlabs';
import { createReadStream } from 'fs';
import type { ReadStream } from 'fs';

// Define types for transcription options
export type TranscriptionOptions = {
  language?: string;
  diarize?: boolean;
  numSpeakers?: number;
  timestampsGranularity?: 'word' | 'character' | 'none';
  tagAudioEvents?: boolean;
};

// Define types for transcription response
export type TranscriptionResponse = {
  language_code: string;
  language_probability: number;
  text: string;
  words: TranscriptionWord[];
};

export type TranscriptionWord = {
  text: string;
  type: 'word' | 'spacing' | 'audio_event';
  start?: number;
  end?: number;
  speaker_id?: string;
  characters?: TranscriptionCharacter[];
};

export type TranscriptionCharacter = {
  text: string;
  start?: number;
  end?: number;
};

// Define the params interface to fix type issues
interface TranscriptionParams {
  file: ReadStream;
  model_id: string;
  language_code?: string;
  diarize?: boolean;
  num_speakers?: number;
  timestamps_granularity?: 'word' | 'character';
  tag_audio_events?: boolean;
}

/**
 * ElevenLabs API client wrapper
 */
export class ElevenLabsAPI {
  private client: ElevenLabsClient;
  private maxRetries: number;
  private retryDelay: number;

  /**
   * Creates a new ElevenLabs API client
   * @param apiKey The API key for authentication
   * @param maxRetries Maximum number of retries for failed requests
   * @param retryDelay Delay between retries in milliseconds
   */
  constructor(
    apiKey: string,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ) {
    if (!apiKey) {
      throw new Error('ElevenLabs API key is required');
    }

    this.client = new ElevenLabsClient({ apiKey });
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Transcribes an audio file
   * @param filePath Path to the audio file
   * @param options Transcription options
   * @returns Transcription response
   */
  async transcribeFile(
    filePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResponse> {
    // Validate file exists
    try {
      const fileStream = createReadStream(filePath);
      
      // Set default options
      const modelId = 'scribe_v1'; // Currently the only available model
      
      // Prepare request parameters
      const params: TranscriptionParams = {
        file: fileStream,
        model_id: modelId,
        language_code: options.language,
        diarize: options.diarize,
        num_speakers: options.numSpeakers,
        tag_audio_events: options.tagAudioEvents !== undefined ? options.tagAudioEvents : true
      };
      
      // Handle timestamps_granularity - exclude 'none' as it's not accepted by the API
      if (options.timestampsGranularity && options.timestampsGranularity !== 'none') {
        params.timestamps_granularity = options.timestampsGranularity;
      }

      // Remove undefined values
      Object.keys(params).forEach(key => {
        if (params[key as keyof TranscriptionParams] === undefined) {
          delete params[key as keyof TranscriptionParams];
        }
      });

      // Execute request with retry logic
      return await this.executeWithRetry(() => 
        this.client.speechToText.convert(params as any)
      );
    } catch (error: unknown) {
      console.error('Error transcribing file:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to transcribe file: ${errorMessage}`);
    }
  }

  /**
   * Executes a function with retry logic
   * @param fn Function to execute
   * @returns Result of the function
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | unknown = new Error('Unknown error occurred');
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Attempt ${attempt + 1}/${this.maxRetries} failed:`, errorMessage);
        lastError = error;
        
        // Check if we should retry based on error type
        if (this.isRetryableError(error)) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        } else {
          // Non-retryable error, throw immediately
          throw error;
        }
      }
    }
    
    // If we've exhausted all retries
    throw lastError;
  }

  /**
   * Determines if an error is retryable
   * @param error The error to check
   * @returns True if the error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    // Network errors, rate limits, and server errors are retryable
    if (typeof error === 'object' && error !== null) {
      const err = error as { status?: number };
      if (!err.status) return true; // Network error
      
      // Retry on rate limits (429) and server errors (5xx)
      return err.status === 429 || (err.status >= 500 && err.status < 600);
    }
    
    return true; // Default to retry for unknown error types
  }
}

/**
 * Creates a new ElevenLabs API client
 * @returns ElevenLabs API client
 */
export function createElevenLabsClient(): ElevenLabsAPI {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  }
  
  return new ElevenLabsAPI(apiKey);
} 