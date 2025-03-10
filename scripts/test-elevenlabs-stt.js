#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { ElevenLabsClient } = require('elevenlabs');
const fs = require('fs');
const path = require('path');

async function testElevenLabsSTT() {
  console.log('Testing ElevenLabs Speech-to-Text API...');
  
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
    
    // Check if the Speech-to-Text API is available
    console.log('Getting available models...');
    const models = await client.models.getAll();
    
    // Check if there's a Speech-to-Text model
    const sttModel = models.find(model => model.model_id === 'scribe_v1');
    if (!sttModel) {
      console.error('Speech-to-Text model (scribe_v1) not found');
      console.log('Available models:', models.map(m => m.model_id));
      return;
    }
    
    console.log('Speech-to-Text model found:', sttModel.model_id);
    
    // Create a test audio file
    const testAudioPath = path.join(__dirname, 'test-audio.mp3');
    if (!fs.existsSync(testAudioPath)) {
      console.error('Test audio file not found:', testAudioPath);
      console.log('Please create a test audio file at:', testAudioPath);
      return;
    }
    
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
      console.log('ElevenLabs Speech-to-Text API is working!');
    } catch (sttError) {
      console.error('Error transcribing audio:', sttError);
      
      // Check if the error is related to the Speech-to-Text API not being available
      if (sttError.message && sttError.message.includes('404')) {
        console.error('Speech-to-Text API endpoint not found. This feature might not be available in the ElevenLabs API yet.');
      }
    }
  } catch (error) {
    console.error('Error testing ElevenLabs API:', error);
  }
}

testElevenLabsSTT(); 