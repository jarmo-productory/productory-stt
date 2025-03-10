#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function testSpeechToText() {
  console.log('Testing ElevenLabs Speech-to-Text API directly...');
  
  // Get API key from environment variable
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY environment variable is not set in .env.local');
    process.exit(1);
  }
  
  console.log('API Key:', apiKey.substring(0, 5) + '****' + apiKey.substring(apiKey.length - 4));
  
  // Check if test audio file exists
  const testAudioPath = path.join(__dirname, 'test-audio.mp3');
  if (!fs.existsSync(testAudioPath)) {
    console.error('Test audio file not found:', testAudioPath);
    console.log('Please create a test audio file at:', testAudioPath);
    return;
  }
  
  try {
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testAudioPath));
    formData.append('model_id', 'scribe_v1'); // Try with scribe_v1 model
    formData.append('language_code', 'en');
    
    // Make direct API call to ElevenLabs Speech-to-Text endpoint
    console.log('Making direct API call to ElevenLabs Speech-to-Text endpoint...');
    const response = await axios.post(
      'https://api.elevenlabs.io/v1/speech-to-text',
      formData,
      {
        headers: {
          'xi-api-key': apiKey,
          ...formData.getHeaders()
        }
      }
    );
    
    console.log('API Response:', response.data);
    console.log('✅ Speech-to-Text API call successful!');
  } catch (error) {
    console.error('Error calling Speech-to-Text API:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      
      // Try alternative endpoint
      if (error.response.status === 404) {
        console.log('Trying alternative endpoint...');
        try {
          const formData = new FormData();
          formData.append('file', fs.createReadStream(testAudioPath));
          
          const response = await axios.post(
            'https://api.elevenlabs.io/v1/speech-recognition',
            formData,
            {
              headers: {
                'xi-api-key': apiKey,
                ...formData.getHeaders()
              }
            }
          );
          
          console.log('Alternative API Response:', response.data);
          console.log('✅ Alternative Speech-to-Text API call successful!');
        } catch (altError) {
          console.error('Error calling alternative Speech-to-Text API:', altError.message);
          if (altError.response) {
            console.error('Alternative response status:', altError.response.status);
            console.error('Alternative response data:', altError.response.data);
          }
        }
      }
    }
  }
}

testSpeechToText(); 