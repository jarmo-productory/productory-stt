#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
// Import ElevenLabs API client
// Note: Since this is a Node.js script and the ElevenLabsAPI is in a TypeScript file,
// we need to create a simple wrapper for it

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  process.exit(1);
}

if (!ELEVENLABS_API_KEY) {
  console.error('Error: ELEVENLABS_API_KEY environment variable is not set');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Create a simple wrapper for the ElevenLabs API
// This is a simplified version of the ElevenLabsAPI class in lib/elevenlabs.ts
const { ElevenLabsClient } = require('elevenlabs');

// Add logging utility at the top after the imports
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor(context = {}) {
    this.context = context;
    this.logLevel = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : LOG_LEVELS.INFO;
  }

  formatMessage(level, message, extra = {}) {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...this.context,
      ...extra
    });
  }

  debug(message, extra = {}) {
    if (this.logLevel <= LOG_LEVELS.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, extra));
    }
  }

  info(message, extra = {}) {
    if (this.logLevel <= LOG_LEVELS.INFO) {
      console.log(this.formatMessage('INFO', message, extra));
    }
  }

  warn(message, extra = {}) {
    if (this.logLevel <= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message, extra));
    }
  }

  error(message, error, extra = {}) {
    if (this.logLevel <= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message, {
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
          ...error
        },
        ...extra
      }));
    }
  }

  child(additionalContext = {}) {
    return new Logger({ ...this.context, ...additionalContext });
  }
}

// Create base logger
const logger = new Logger();

class ElevenLabsAPI {
  constructor(apiKey, maxRetries = 3, retryDelay = 1000) {
    this.client = new ElevenLabsClient({ apiKey });
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  async transcribeFile(filePath, options = {}) {
    try {
      const fileStream = fs.createReadStream(filePath);
      
      // Set default options
      const modelId = 'scribe_v1'; // Currently the only available model
      
      // Prepare request parameters
      const params = {
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
        if (params[key] === undefined) {
          delete params[key];
        }
      });

      // Execute request with retry logic
      return await this.executeWithRetry(() => 
        this.client.speechToText.convert(params)
      );
    } catch (error) {
      console.error('Error transcribing file:', error);
      throw new Error(`Failed to transcribe file: ${error.message || String(error)}`);
    }
  }

  async executeWithRetry(fn) {
    let lastError = new Error('Unknown error occurred');
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const errorMessage = error.message || String(error);
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

  isRetryableError(error) {
    // Network errors, rate limits, and server errors are retryable
    if (typeof error === 'object' && error !== null) {
      const err = error;
      if (!err.status) return true; // Network error
      
      // Retry on rate limits (429) and server errors (5xx)
      return err.status === 429 || (err.status >= 500 && err.status < 600);
    }
    
    return true; // Default to retry for unknown error types
  }
}

// Create ElevenLabs API client
const elevenLabsClient = new ElevenLabsAPI(ELEVENLABS_API_KEY, 3, 2000);

async function processJob() {
  const baseLogger = logger.child({ component: 'job-processor' });
  
  try {
    baseLogger.info('Fetching pending transcription job');
    
    // Get the pending job
    const { data: jobs, error: jobsError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('job_type', 'transcription')
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (jobsError) {
      baseLogger.error('Failed to fetch jobs', jobsError);
      return;
    }
    
    if (!jobs || jobs.length === 0) {
      baseLogger.debug('No pending transcription jobs found');
      return;
    }
    
    const job = jobs[0];
    const jobLogger = baseLogger.child({ 
      job_id: job.id, 
      transcription_id: job.payload.transcription_id,
      file_id: job.payload.file_id 
    });
    
    jobLogger.info('Starting job processing', {
      job_type: job.job_type,
      attempts: job.attempts,
      created_at: job.created_at
    });
    
    // Update job status to processing
    const { error: updateError } = await supabase
      .from('job_queue')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString(),
        attempts: job.attempts + 1
      })
      .eq('id', job.id);
    
    if (updateError) {
      jobLogger.error('Failed to update job status', updateError);
      return;
    }
    
    jobLogger.debug('Updated job status to processing');
    
    // Update transcription status to processing
    const { error: transcriptionUpdateError } = await supabase
      .from('transcriptions')
      .update({ status: 'processing' })
      .eq('id', job.payload.transcription_id);
    
    if (transcriptionUpdateError) {
      jobLogger.error('Failed to update transcription status', transcriptionUpdateError);
      
      // Mark job as failed
      await supabase
        .from('job_queue')
        .update({ 
          status: 'failed', 
          completed_at: new Date().toISOString(),
          error_message: `Failed to update transcription status: ${transcriptionUpdateError.message}`
        })
        .eq('id', job.id);
      
      return;
    }
    
    // Get the audio file information
    jobLogger.debug('Fetching audio file information');
    const { data: fileData, error: fileError } = await supabase
      .from('audio_files')
      .select('*')
      .eq('id', job.payload.file_id)
      .single();
    
    if (fileError || !fileData) {
      const errorMessage = `Failed to fetch audio file information: ${fileError?.message || 'File not found'}`;
      jobLogger.error('Audio file fetch failed', fileError || new Error('File not found'), {
        file_id: job.payload.file_id
      });
      
      // Mark job as failed
      await supabase
        .from('job_queue')
        .update({ 
          status: 'failed', 
          completed_at: new Date().toISOString(),
          error_message: errorMessage
        })
        .eq('id', job.id);
      
      await supabase
        .from('transcriptions')
        .update({ 
          status: 'failed',
          error_message: errorMessage
        })
        .eq('id', job.payload.transcription_id);
      
      return;
    }
    
    // Download the audio file from Supabase storage
    jobLogger.info('Downloading audio file', { 
      file_path: fileData.file_path,
      file_size: fileData.size,
      file_format: fileData.format
    });
    
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcription-'));
    const tempFilePath = path.join(tempDir, path.basename(fileData.file_path));
    
    try {
      // Determine the correct storage path
      // Some files have paths like "audio/{user_id}/{filename}" while others just have the filename
      let storagePath = fileData.file_path;
      
      // If the path doesn't start with "audio/", prepend the standard format
      if (!storagePath.startsWith('audio/')) {
        storagePath = `audio/${fileData.user_id}/${fileData.file_path}`;
      }
      
      console.log(`Attempting to download from storage path: ${storagePath}`);
      
      // Try to download the file
      const { data: fileContent, error: downloadError } = await supabase
        .storage
        .from('audio-files')
        .download(storagePath);
      
      // If the first attempt fails, try alternative path formats
      if (downloadError || !fileContent) {
        jobLogger.warn('First download attempt failed, trying alternative path', { 
          original_path: storagePath,
          error: downloadError?.message 
        });
        console.log('Trying alternative path format...');
        
        // Try just the filename
        storagePath = fileData.file_path;
        const { data: altFileContent, error: altDownloadError } = await supabase
          .storage
          .from('audio-files')
          .download(storagePath);
          
        if (altDownloadError || !altFileContent) {
          // Try with just the user ID and filename
          storagePath = `${fileData.user_id}/${fileData.file_path}`;
          console.log(`Trying path: ${storagePath}`);
          
          const { data: alt2FileContent, error: alt2DownloadError } = await supabase
            .storage
            .from('audio-files')
            .download(storagePath);
            
          if (alt2DownloadError || !alt2FileContent) {
            throw new Error(`Failed to download audio file after multiple attempts: ${alt2DownloadError?.message || 'Unknown error'}`);
          }
          
          // Save the file to a temporary location
          fs.writeFileSync(tempFilePath, Buffer.from(await alt2FileContent.arrayBuffer()));
        } else {
          // Save the file to a temporary location
          fs.writeFileSync(tempFilePath, Buffer.from(await altFileContent.arrayBuffer()));
        }
      } else {
        // Save the file to a temporary location
        fs.writeFileSync(tempFilePath, Buffer.from(await fileContent.arrayBuffer()));
      }
      
      console.log(`Audio file saved to temporary location: ${tempFilePath}`);
      
      // Call ElevenLabs API for transcription
      jobLogger.info('Starting transcription', { 
        options: transcriptionOptions,
        temp_file_path: tempFilePath
      });
      
      // Prepare transcription options
      const transcriptionOptions = {
        language: job.payload.language,
        diarize: job.payload.diarize,
        numSpeakers: job.payload.num_speakers,
        timestampsGranularity: job.payload.timestamps_granularity,
        tagAudioEvents: job.payload.tag_audio_events
      };
      
      // Call the API
      const transcriptionResult = await elevenLabsClient.transcribeFile(tempFilePath, transcriptionOptions);
      
      jobLogger.info('Transcription completed', {
        language: transcriptionResult.language_code,
        language_probability: transcriptionResult.language_probability,
        text_length: transcriptionResult.text.length,
        word_count: transcriptionResult.words.length
      });
      
      // Process the transcription result
      // Extract segments from words
      const segments = [];
      let currentSegment = null;
      let segmentIndex = 0;
      
      // Group words into segments based on speaker changes and pauses
      for (let i = 0; i < transcriptionResult.words.length; i++) {
        const word = transcriptionResult.words[i];
        
        // Skip non-word entries (spacing, audio_events)
        if (word.type !== 'word') continue;
        
        // If no current segment or speaker changed or long pause (> 1 second), create a new segment
        const shouldCreateNewSegment = !currentSegment || 
          (word.speaker_id && currentSegment.speaker_id !== word.speaker_id) ||
          (currentSegment.words.length > 0 && 
           word.start && 
           currentSegment.words[currentSegment.words.length - 1].end && 
           (word.start - currentSegment.words[currentSegment.words.length - 1].end > 1.0));
        
        if (shouldCreateNewSegment) {
          // If we have a current segment, finalize it and add to segments
          if (currentSegment) {
            currentSegment.end_time = currentSegment.words[currentSegment.words.length - 1].end || 0;
            currentSegment.text = currentSegment.words.map(w => w.text).join(' ');
            segments.push({
              transcription_id: job.payload.transcription_id,
              start_time: currentSegment.start_time,
              end_time: currentSegment.end_time,
              text: currentSegment.text,
              original_text: currentSegment.text,
              type: 'segment',
              sequence_number: segmentIndex++,
              speaker_id: currentSegment.speaker_id || 'speaker_1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
          
          // Create a new segment
          currentSegment = {
            start_time: word.start || 0,
            speaker_id: word.speaker_id || 'speaker_1',
            words: [word]
          };
        } else {
          // Add word to current segment
          currentSegment.words.push(word);
        }
      }
      
      // Add the last segment if it exists
      if (currentSegment && currentSegment.words.length > 0) {
        currentSegment.end_time = currentSegment.words[currentSegment.words.length - 1].end || 0;
        currentSegment.text = currentSegment.words.map(w => w.text).join(' ');
        segments.push({
          transcription_id: job.payload.transcription_id,
          start_time: currentSegment.start_time,
          end_time: currentSegment.end_time,
          text: currentSegment.text,
          original_text: currentSegment.text,
          type: 'segment',
          sequence_number: segmentIndex++,
          speaker_id: currentSegment.speaker_id || 'speaker_1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      // Calculate word count
      const wordCount = transcriptionResult.words.filter(w => w.type === 'word').length;
      
      // Calculate duration from the last word's end time
      const duration = segments.length > 0 ? 
        segments[segments.length - 1].end_time : 
        (transcriptionResult.words.length > 0 ? 
          (transcriptionResult.words[transcriptionResult.words.length - 1].end || 0) : 0);
      
      // Store transcription segments
      jobLogger.info('Storing transcription segments', { 
        segment_count: segments.length,
        total_duration: duration,
        word_count: wordCount
      });
      
      // Insert segments
      const { error: segmentsError } = await supabase
        .from('transcription_segments')
        .insert(segments);
      
      if (segmentsError) {
        console.error('Error storing transcription segments:', segmentsError);
        
        // Mark job and transcription as failed
        await supabase
          .from('job_queue')
          .update({ 
            status: 'failed', 
            completed_at: new Date().toISOString(),
            error_message: `Failed to store transcription segments: ${segmentsError.message}`
          })
          .eq('id', job.id);
        
        await supabase
          .from('transcriptions')
          .update({ 
            status: 'failed',
            error_message: `Failed to store transcription segments: ${segmentsError.message}`
          })
          .eq('id', job.payload.transcription_id);
        
        return;
      }
      
      // Update transcription with results
      console.log('Updating transcription with results...');
      
      const { error: finalUpdateError } = await supabase
        .from('transcriptions')
        .update({
          status: 'completed',
          raw_text: transcriptionResult.text,
          language: transcriptionResult.language_code,
          language_probability: transcriptionResult.language_probability,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.payload.transcription_id);
      
      if (finalUpdateError) {
        console.error('Error updating transcription:', finalUpdateError);
        
        // Mark job as failed
        await supabase
          .from('job_queue')
          .update({ 
            status: 'failed', 
            completed_at: new Date().toISOString(),
            error_message: `Failed to update transcription: ${finalUpdateError.message}`
          })
          .eq('id', job.id);
        
        return;
      }
      
      // Mark job as completed
      jobLogger.info('Job completed successfully', {
        duration,
        word_count: wordCount,
        segment_count: segments.length
      });
      
      const { error: jobCompleteError } = await supabase
        .from('job_queue')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString(),
          result: {
            success: true,
            transcription_id: job.payload.transcription_id,
            file_id: job.payload.file_id,
            duration: duration,
            word_count: wordCount
          }
        })
        .eq('id', job.id);
      
      if (jobCompleteError) {
        console.error('Error marking job as completed:', jobCompleteError);
        return;
      }
      
      console.log('Job processed successfully!');
      console.log(`Transcription ${job.payload.transcription_id} is now complete.`);
      
    } catch (error) {
      baseLogger.error('Fatal error in job processing', error, {
        job_id: job?.id,
        transcription_id: job?.payload?.transcription_id
      });
      
      if (job) {
        // Mark job and transcription as failed
        await supabase
          .from('job_queue')
          .update({ 
            status: 'failed', 
            completed_at: new Date().toISOString(),
            error_message: error.message || 'Unknown error during transcription'
          })
          .eq('id', job.id);
        
        await supabase
          .from('transcriptions')
          .update({ 
            status: 'failed',
            error_message: error.message || 'Unknown error during transcription'
          })
          .eq('id', job.payload.transcription_id);
      }
    } finally {
      // Clean up temporary files
      if (tempFilePath && tempDir) {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            baseLogger.debug('Cleaned up temporary file', { path: tempFilePath });
          }
          fs.rmdirSync(tempDir);
          baseLogger.debug('Cleaned up temporary directory', { path: tempDir });
        } catch (cleanupError) {
          baseLogger.warn('Failed to clean up temporary files', { 
            error: cleanupError.message,
            temp_file: tempFilePath,
            temp_dir: tempDir
          });
        }
      }
    }
    
  } catch (error) {
    baseLogger.error('Fatal error in job processing', error, {
      job_id: job?.id,
      transcription_id: job?.payload?.transcription_id
    });
    
    if (job) {
      // Mark job and transcription as failed
      await supabase
        .from('job_queue')
        .update({ 
          status: 'failed', 
          completed_at: new Date().toISOString(),
          error_message: error.message || 'Unknown error during transcription'
        })
        .eq('id', job.id);
      
      await supabase
        .from('transcriptions')
        .update({ 
          status: 'failed',
          error_message: error.message || 'Unknown error during transcription'
        })
        .eq('id', job.payload.transcription_id);
    }
  }
}

// Run the job processor
processJob(); 