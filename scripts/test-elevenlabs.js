#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { ElevenLabsClient } = require('elevenlabs');

async function testElevenLabsAPI() {
  console.log('Testing ElevenLabs API...');
  
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
    
    // Test the API by getting user info
    console.log('Getting user info...');
    const user = await client.user.get();
    console.log('User info:', user);
    
    // Test the API by getting available models
    console.log('Getting available models...');
    const models = await client.models.getAll();
    console.log('Available models:', models);
    
    console.log('ElevenLabs API is working!');
  } catch (error) {
    console.error('Error testing ElevenLabs API:', error);
  }
}

testElevenLabsAPI(); 