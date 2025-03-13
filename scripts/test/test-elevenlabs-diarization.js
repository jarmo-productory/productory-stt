#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function testElevenLabsDiarization() {
  console.log('Testing ElevenLabs Speech-to-Text API with diarization...');
  
  // Get API key from environment variable
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY environment variable is not set in .env.local');
    process.exit(1);
  }
  
  console.log('API Key:', apiKey.substring(0, 5) + '****' + apiKey.substring(apiKey.length - 4));
  
  // Use the Solaris Keskus.wav file which likely has multiple speakers
  const testAudioPath = path.join(__dirname, '../../audio-files/audio/7237b3a3-e1a7-4473-bbd7-0a6bece0b659/transcription/Solaris Keskus.wav');
  
  // Alternatively, use the shorter test file if the full file is too large
  // const testAudioPath = path.join(__dirname, '../test-audio.mp3');
  
  if (!fs.existsSync(testAudioPath)) {
    console.error('Test audio file not found:', testAudioPath);
    return;
  }
  
  // Get file stats
  const stats = fs.statSync(testAudioPath);
  console.log('Test audio file:', testAudioPath);
  console.log('File size:', (stats.size / (1024 * 1024)).toFixed(2), 'MB');
  
  try {
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testAudioPath));
    formData.append('model_id', 'scribe_v1');
    formData.append('language_code', 'en');
    formData.append('timestamps_granularity', 'word');
    
    // Enable diarization with specific number of speakers
    formData.append('diarize', 'true');
    formData.append('num_speakers', '2'); // Test with 2 speakers
    
    console.log('Request configuration:');
    console.log('- Model: scribe_v1');
    console.log('- Language: en');
    console.log('- Timestamps granularity: word');
    console.log('- Diarization: enabled');
    console.log('- Number of speakers: 2');
    
    // Make direct API call to ElevenLabs Speech-to-Text endpoint
    console.log('\nMaking direct API call to ElevenLabs Speech-to-Text endpoint...');
    console.log('This may take a while for a large file...');
    
    const response = await axios.post(
      'https://api.elevenlabs.io/v1/speech-to-text',
      formData,
      {
        headers: {
          'xi-api-key': apiKey,
          ...formData.getHeaders()
        },
        // Add a longer timeout for large files
        timeout: 600000 // 10 minutes
      }
    );
    
    console.log('\n✅ Speech-to-Text API call successful!');
    
    // Check if diarization was successful
    const words = response.data.words || [];
    const speakerIds = new Set();
    
    words.forEach(word => {
      if (word.speaker_id) {
        speakerIds.add(word.speaker_id);
      }
    });
    
    console.log('\nDiarization results:');
    console.log(`- Total words: ${words.length}`);
    console.log(`- Words with speaker IDs: ${words.filter(w => w.speaker_id).length}`);
    console.log(`- Unique speakers detected: ${speakerIds.size}`);
    console.log(`- Speaker IDs: ${Array.from(speakerIds).join(', ')}`);
    
    if (speakerIds.size > 0) {
      console.log('\n✅ Diarization is supported and working!');
      
      // Print a sample of words with their speaker IDs
      console.log('\nSample of words with speaker IDs:');
      const sampleWords = words.filter(w => w.speaker_id && w.type === 'word').slice(0, 10);
      sampleWords.forEach(word => {
        console.log(`- "${word.text}" (Speaker: ${word.speaker_id}, Time: ${word.start}s - ${word.end}s)`);
      });
    } else {
      console.log('\n❌ No speaker IDs found in the response. Diarization might not be working.');
    }
    
    // Save full response to a file for further analysis
    const outputPath = path.join(__dirname, 'elevenlabs-diarization-response.json');
    fs.writeFileSync(outputPath, JSON.stringify(response.data, null, 2));
    console.log(`\nFull response saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('\n❌ Error calling Speech-to-Text API:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testElevenLabsDiarization(); 