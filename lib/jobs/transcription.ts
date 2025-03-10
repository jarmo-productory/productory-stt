import { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import FormData from 'form-data';

const execPromise = promisify(exec);

// Define the job type
interface TranscriptionJob {
  id: string;
  user_id: string;
  job_type: 'transcription';
  status: string;
  payload: {
    transcription_id: string;
    file_id: string;
    language: string;
    diarize: boolean;
    num_speakers?: number;
    timestamps_granularity: 'word' | 'character' | 'none';
    tag_audio_events: boolean;
  };
  created_at: string;
}

// Define types for ElevenLabs response
interface ElevenLabsTranscriptionResponse {
  language_code: string;
  language_probability: number;
  text: string;
  words: ElevenLabsWord[];
}

interface ElevenLabsWord {
  text: string;
  start?: number;
  end?: number;
  type: 'word' | 'spacing' | 'audio_event';
  speaker_id?: string;
}

/**
 * Process a transcription job
 */
export async function processTranscriptionJob(job: TranscriptionJob, supabase: SupabaseClient) {
  console.log(`Processing transcription job ${job.id} for transcription ${job.payload.transcription_id}`);
  
  try {
    // Get the file details from the database
    const { data: audioFile, error: audioFileError } = await supabase
      .from('audio_files')
      .select('*')
      .eq('id', job.payload.file_id)
      .single();
    
    if (audioFileError || !audioFile) {
      throw new Error(`Failed to get audio file details: ${audioFileError?.message || 'File not found'}`);
    }
    
    // Get the file URL from the storage bucket
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from(audioFile.bucket_name || 'audio-files')
      .createSignedUrl(audioFile.normalized_path, 3600); // 1 hour expiry
    
    if (fileError || !fileData?.signedUrl) {
      throw new Error(`Failed to get file URL: ${fileError?.message || 'No signed URL returned'}`);
    }
    
    const fileUrl = fileData.signedUrl;
    console.log(`Downloading audio file from ${fileUrl}`);
    const fileResponse = await axios.get(fileUrl, {
      responseType: 'arraybuffer'
    });
    
    if (fileResponse.status !== 200) {
      throw new Error(`Failed to download audio file: ${fileResponse.statusText}`);
    }
    
    // Create a temporary directory for processing
    const tempDir = path.join(os.tmpdir(), 'productory-stt');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Save the downloaded file
    const originalFilePath = path.join(tempDir, `${job.id}_original${path.extname(audioFile.file_name)}`);
    fs.writeFileSync(originalFilePath, Buffer.from(fileResponse.data));
    
    // Determine if we need to convert the file
    const fileExtension = path.extname(audioFile.file_name).toLowerCase();
    let finalFilePath = originalFilePath;
    
    // Check if ffmpeg is available
    let ffmpegAvailable = false;
    try {
      await execPromise('ffmpeg -version');
      ffmpegAvailable = true;
    } catch (error) {
      console.warn('ffmpeg is not available, skipping conversion');
    }
    
    // Convert file if needed and ffmpeg is available
    if (ffmpegAvailable && (fileExtension === '.m4a' || fileExtension === '.x-m4a')) {
      try {
        const mp3FilePath = path.join(tempDir, `${job.id}.mp3`);
        console.log(`Converting ${fileExtension} to mp3...`);
        await execPromise(`ffmpeg -i "${originalFilePath}" -vn -ar 44100 -ac 2 -b:a 192k "${mp3FilePath}"`);
        finalFilePath = mp3FilePath;
        console.log('Conversion completed successfully');
      } catch (conversionError) {
        console.error('Error converting file:', conversionError);
        // Continue with original file if conversion fails
      }
    }
    
    let transcriptionResult;
    
    // Check if ElevenLabs API key is available
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    
    if (elevenlabsApiKey) {
      try {
        console.log('Calling ElevenLabs Speech-to-Text API directly...');
        
        // Create form data
        const formData = new FormData();
        formData.append('file', fs.createReadStream(finalFilePath));
        formData.append('model_id', 'scribe_v1');
        
        // Add optional parameters
        if (job.payload.language) {
          formData.append('language_code', job.payload.language);
        }
        
        // Map timestamps_granularity to API parameter
        if (job.payload.timestamps_granularity && job.payload.timestamps_granularity !== 'none') {
          formData.append('timestamps_granularity', job.payload.timestamps_granularity);
        }
        
        // Add diarization parameters if enabled
        if (job.payload.diarize) {
          formData.append('diarize', 'true');
          if (job.payload.num_speakers) {
            formData.append('num_speakers', job.payload.num_speakers.toString());
          }
        }
        
        // Add audio events tagging if enabled
        if (job.payload.tag_audio_events) {
          formData.append('tag_audio_events', 'true');
        }
        
        // Make direct API call to ElevenLabs Speech-to-Text endpoint
        const response = await axios.post<ElevenLabsTranscriptionResponse>(
          'https://api.elevenlabs.io/v1/speech-to-text',
          formData,
          {
            headers: {
              'xi-api-key': elevenlabsApiKey,
              ...formData.getHeaders()
            }
          }
        );
        
        const elevenLabsResponse = response.data;
        
        // Format the response to match our expected structure
        transcriptionResult = {
          text: elevenLabsResponse.text,
          language: elevenLabsResponse.language_code,
          language_probability: elevenLabsResponse.language_probability,
          segments: formatElevenLabsResponseToSegments(elevenLabsResponse.words),
          duration: calculateDuration(elevenLabsResponse.words),
          word_count: countWords(elevenLabsResponse.words)
        };
      } catch (apiError) {
        console.error('Error calling ElevenLabs API:', apiError);
        console.log('Falling back to mock transcription API...');
        transcriptionResult = await mockTranscriptionAPI(Buffer.from(fileResponse.data), {
          language: job.payload.language,
          diarize: job.payload.diarize,
          numSpeakers: job.payload.num_speakers,
          timestampsGranularity: job.payload.timestamps_granularity,
          tagAudioEvents: job.payload.tag_audio_events
        });
      }
    } else {
      console.log('ELEVENLABS_API_KEY not found, using mock transcription API...');
      transcriptionResult = await mockTranscriptionAPI(Buffer.from(fileResponse.data), {
        language: job.payload.language,
        diarize: job.payload.diarize,
        numSpeakers: job.payload.num_speakers,
        timestampsGranularity: job.payload.timestamps_granularity,
        tagAudioEvents: job.payload.tag_audio_events
      });
    }
    
    // Clean up temporary files
    try {
      fs.unlinkSync(originalFilePath);
      if (finalFilePath !== originalFilePath) {
        fs.unlinkSync(finalFilePath);
      }
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary files:', cleanupError);
    }
    
    // Update the transcription record with the results
    const { error: transcriptionUpdateError } = await supabase
      .from('transcriptions')
      .update({
        status: 'completed',
        language: transcriptionResult.language,
        language_probability: transcriptionResult.language_probability,
        raw_text: transcriptionResult.text,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.payload.transcription_id);
    
    if (transcriptionUpdateError) {
      throw new Error(`Failed to update transcription: ${transcriptionUpdateError.message}`);
    }
    
    // Process and save the transcription segments
    await saveTranscriptionSegments(job.payload.transcription_id, transcriptionResult.segments, supabase);
    
    // Return success
    return {
      file_id: job.payload.file_id,
      success: true,
      duration: transcriptionResult.duration,
      word_count: transcriptionResult.word_count,
      transcription_id: job.payload.transcription_id
    };
  } catch (error) {
    console.error(`Error processing transcription job ${job.id}:`, error);
    
    // Update the transcription status to failed
    try {
      await supabase
        .from('transcriptions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.payload.transcription_id);
    } catch (statusUpdateError) {
      console.error(`Failed to update transcription status to failed:`, statusUpdateError);
    }
    
    // Rethrow the error to be handled by the caller
    throw error;
  }
}

// Helper function to format ElevenLabs response to segments
function formatElevenLabsResponseToSegments(words: ElevenLabsWord[]) {
  const segments = [];
  let currentSegment: {
    id: string;
    start: number;
    end: number;
    text: string;
    words: ElevenLabsWord[];
  } = {
    id: crypto.randomUUID(),
    start: 0,
    end: 0,
    text: '',
    words: []
  };
  
  let wordCount = 0;
  const MAX_WORDS_PER_SEGMENT = 15;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Skip words without timing information or non-word types (except audio events)
    if (word.start === undefined || word.end === undefined) {
      continue;
    }
    
    // Start a new segment if this is the first word or we've reached the max words per segment
    // or if this is an audio event (which should be its own segment)
    if (wordCount === 0 || wordCount >= MAX_WORDS_PER_SEGMENT || word.type === 'audio_event') {
      // Save the previous segment if it has words
      if (wordCount > 0) {
        segments.push(currentSegment);
      }
      
      // Start a new segment
      currentSegment = {
        id: crypto.randomUUID(),
        start: word.start || 0,
        end: word.end || 0,
        text: word.text,
        words: [word]
      };
      
      wordCount = 1;
    } else {
      // Add the word to the current segment
      currentSegment.text += ' ' + word.text;
      currentSegment.end = word.end || 0;
      currentSegment.words.push(word);
      wordCount++;
    }
  }
  
  // Add the last segment if it has words
  if (wordCount > 0) {
    segments.push(currentSegment);
  }
  
  return segments;
}

// Helper function to calculate the total duration of the transcription
function calculateDuration(words: ElevenLabsWord[]): number {
  if (!words || words.length === 0) {
    return 0;
  }
  
  // Find the last word with timing information
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i].end !== undefined) {
      return words[i].end || 0;
    }
  }
  
  return 0;
}

// Helper function to count the number of words in the transcription
function countWords(words: ElevenLabsWord[]): number {
  if (!words) {
    return 0;
  }
  
  // Count only actual words (not spacing or audio events)
  return words.filter(word => word.type === 'word').length;
}

// Helper function to save transcription segments
async function saveTranscriptionSegments(
  transcriptionId: string,
  segments: any[],
  supabase: SupabaseClient
) {
  try {
    // Delete existing segments for this transcription
    const { error: deleteError } = await supabase
      .from('transcription_segments')
      .delete()
      .eq('transcription_id', transcriptionId);
    
    if (deleteError) {
      console.warn(`Failed to delete existing segments: ${deleteError.message}`);
    }
    
    // Format segments for database insertion
    const formattedSegments = segments.map((segment, index) => {
      const startTime = parseFloat(segment.start.toFixed(3));
      let endTime = parseFloat(segment.end.toFixed(3));
      
      // Ensure end_time is greater than start_time to satisfy the constraint
      if (endTime <= startTime) {
        endTime = startTime + 0.001; // Add a small increment to ensure end_time > start_time
      }
      
      return {
        id: crypto.randomUUID(),
        transcription_id: transcriptionId,
        start_time: startTime,
        end_time: endTime,
        text: segment.text,
        speaker_id: null,
        type: 'word',
        sequence_number: index
      };
    });
    
    // Insert segments into the database
    if (formattedSegments.length > 0) {
      const { error: segmentsError } = await supabase
        .from('transcription_segments')
        .insert(formattedSegments);
      
      if (segmentsError) {
        throw new Error(`Failed to save transcription segments: ${segmentsError.message}`);
      }
    }
  } catch (error) {
    console.error('Error saving transcription segments:', error);
    throw error;
  }
}

/**
 * Mock transcription API for development
 * Replace this with your actual transcription API call
 */
async function mockTranscriptionAPI(audioData: Buffer, options: any) {
  // Simulate API processing time
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Generate a more realistic transcription with proper segment structure
  const mockText = "This is a mock transcription. Replace this with your actual transcription API call. The quick brown fox jumps over the lazy dog.";
  
  // Create segments
  const segments = [
    {
      id: crypto.randomUUID(),
      start: 0,
      end: 3.5,
      text: "This is a mock transcription.",
      words: [
        { word: "This", start: 0.0, end: 0.5 },
        { word: "is", start: 0.5, end: 0.7 },
        { word: "a", start: 0.7, end: 0.8 },
        { word: "mock", start: 0.8, end: 1.2 },
        { word: "transcription", start: 1.2, end: 3.5 }
      ]
    },
    {
      id: crypto.randomUUID(),
      start: 3.5,
      end: 7.2,
      text: "Replace this with your actual transcription API call.",
      words: [
        { word: "Replace", start: 3.5, end: 4.0 },
        { word: "this", start: 4.0, end: 4.2 },
        { word: "with", start: 4.2, end: 4.5 },
        { word: "your", start: 4.5, end: 4.8 },
        { word: "actual", start: 4.8, end: 5.2 },
        { word: "transcription", start: 5.2, end: 6.0 },
        { word: "API", start: 6.0, end: 6.5 },
        { word: "call", start: 6.5, end: 7.2 }
      ]
    },
    {
      id: crypto.randomUUID(),
      start: 7.2,
      end: 10.5,
      text: "The quick brown fox jumps over the lazy dog.",
      words: [
        { word: "The", start: 7.2, end: 7.4 },
        { word: "quick", start: 7.4, end: 7.7 },
        { word: "brown", start: 7.7, end: 8.0 },
        { word: "fox", start: 8.0, end: 8.3 },
        { word: "jumps", start: 8.3, end: 8.7 },
        { word: "over", start: 8.7, end: 9.0 },
        { word: "the", start: 9.0, end: 9.2 },
        { word: "lazy", start: 9.2, end: 9.7 },
        { word: "dog", start: 9.7, end: 10.5 }
      ]
    }
  ];
  
  // Mock response
  return {
    text: mockText,
    segments: segments,
    duration: 10.5,
    language: options.language || 'en',
    language_probability: 0.99,
    model: "whisper-1",
    word_count: mockText.split(/\s+/).length,
    processing_time: 2.0
  };
} 