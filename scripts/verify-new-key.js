#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { ElevenLabsClient } = require('elevenlabs');

async function verifyApiKey(apiKey) {
  console.log('Verifying ElevenLabs API key...');
  
  if (!apiKey) {
    console.error('No API key provided');
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
    console.log('Available models:', models.map(m => m.model_id));
    
    // Check if the Scribe model is available
    const sttModel = models.find(model => model.model_id === 'scribe_v1');
    if (sttModel) {
      console.log('✅ Speech-to-Text model (scribe_v1) is available!');
      console.log('Model details:', sttModel);
    } else {
      console.error('❌ Speech-to-Text model (scribe_v1) not found');
      console.log('Available models:', models.map(m => ({ id: m.model_id, name: m.name })));
    }
    
    console.log('API key verification completed!');
  } catch (error) {
    console.error('Error verifying API key:', error);
  }
}

// Get API key from environment variable
const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('ELEVENLABS_API_KEY environment variable is not set in .env.local');
  process.exit(1);
}

verifyApiKey(apiKey); 