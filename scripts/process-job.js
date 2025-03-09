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
  try {
    console.log('Fetching pending transcription job...');
    
    // Get the pending job
    const { data: jobs, error: jobsError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('job_type', 'transcription')
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return;
    }
    
    if (!jobs || jobs.length === 0) {
      console.log('No pending transcription jobs found');
      return;
    }
    
    const job = jobs[0];
    console.log(`Processing job ${job.id} for transcription ${job.payload.transcription_id}`);
    
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
      console.error('Error updating job status:', updateError);
      return;
    }
    
    // Update transcription status to processing
    const { error: transcriptionUpdateError } = await supabase
      .from('transcriptions')
      .update({ status: 'processing' })
      .eq('id', job.payload.transcription_id);
    
    if (transcriptionUpdateError) {
      console.error('Error updating transcription status:', transcriptionUpdateError);
      
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
    console.log(`Fetching audio file information for file ID: ${job.payload.file_id}`);
    const { data: fileData, error: fileError } = await supabase
      .from('audio_files')
      .select('*')
      .eq('id', job.payload.file_id)
      .single();
    
    if (fileError || !fileData) {
      const errorMessage = `Failed to fetch audio file information: ${fileError?.message || 'File not found'}`;
      console.error(errorMessage);
      
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
    console.log(`Downloading audio file: ${fileData.file_path}`);
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
        console.log(`First download attempt failed: ${downloadError?.message || 'Unknown error'}`);
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
      console.log('Calling ElevenLabs API for transcription...');
      
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
      
      console.log('Transcription completed successfully');
      console.log(`Language: ${transcriptionResult.language_code} (probability: ${transcriptionResult.language_probability})`);
      console.log(`Text length: ${transcriptionResult.text.length} characters`);
      console.log(`Words: ${transcriptionResult.words.length}`);
      
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
      console.log(`Storing ${segments.length} transcription segments...`);
      
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
      console.log('Marking job as completed...');
      
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
      console.error('Error processing transcription:', error);
      
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
    } finally {
      // Clean up temporary files
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        fs.rmdirSync(tempDir);
      } catch (cleanupError) {
        console.warn('Error cleaning up temporary files:', cleanupError);
      }
    }
    
  } catch (error) {
    console.error('Error processing job:', error);
  }
}

// Run the job processor
processJob(); 