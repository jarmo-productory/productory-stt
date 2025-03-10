#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { ElevenLabsClient } = require('elevenlabs');
const fs = require('fs');
const path = require('path');

async function testElevenLabsSTTWithMP3() {
  console.log('Testing ElevenLabs Speech-to-Text API with original MP3...');
  
  // Check if API key is set
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY environment variable is not set');
    return;
  }
  
  console.log('API Key:', apiKey.substring(0, 5) + '****' + apiKey.substring(apiKey.length - 4));
  
  try {
    // Create ElevenLabs client
    const client = new ElevenLabsClient({ apiKey });
    
    // Skip model check and directly use scribe_v1
    console.log('Using scribe_v1 model for transcription...');
    
    // Create a test audio file
    const testAudioPath = path.join(__dirname, 'test-audio.mp3');
    if (!fs.existsSync(testAudioPath)) {
      console.error('Test audio file not found:', testAudioPath);
      console.log('Please create a test audio file at:', testAudioPath);
      return;
    }
    
    // Log file information
    const stats = fs.statSync(testAudioPath);
    console.log('Test audio file:', testAudioPath);
    console.log('File size:', stats.size, 'bytes');
    console.log('Format: MP3 (44.1kHz mono)');
    
    // Test the Speech-to-Text API
    console.log('Transcribing test audio file...');
    try {
      const fileStream = fs.createReadStream(testAudioPath);
      
      const transcription = await client.speechToText.convert({
        file: fileStream,
        model_id: 'scribe_v1',
        language_code: 'en',
        timestamps_granularity: 'word',
        tag_audio_events: true
      });
      
      console.log('Transcription result:', transcription);
      console.log('ElevenLabs Speech-to-Text API successfully processed MP3!');
    } catch (sttError) {
      console.error('Error transcribing audio:', sttError);
      
      // Check if the error is related to the Speech-to-Text API not being available
      if (sttError.message && sttError.message.includes('404')) {
        console.error('Speech-to-Text API endpoint not found. This feature might not be available in the ElevenLabs API yet.');
      }
      
      // Check if the error is related to the file format
      if (sttError.message && (sttError.message.includes('format') || sttError.message.includes('unsupported'))) {
        console.error('The MP3 format might not be supported by ElevenLabs API.');
      }
    }
  } catch (error) {
    console.error('Error testing ElevenLabs API:', error);
  }
}

testElevenLabsSTTWithMP3(); 