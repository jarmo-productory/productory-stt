#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const WORKER_API_KEY = process.env.WORKER_API_KEY;

if (!WORKER_API_KEY) {
  console.error('Error: WORKER_API_KEY environment variable is not set');
  process.exit(1);
}

async function testAPI() {
  console.log('Testing API connection...');
  console.log(`API URL: ${API_URL}`);
  
  try {
    // Test basic API connection
    console.log('\nTesting basic API connection...');
    const response = await fetch(`${API_URL}/api/health-check`, {
      method: 'GET'
    }).catch(error => {
      console.error('Network error:', error.message);
      return { ok: false, status: 'network error' };
    });
    
    console.log(`Basic API response status: ${response.status || 'unknown'}`);
    
    if (response.ok) {
      console.log('Basic API is reachable!');
      try {
        const data = await response.json();
        console.log('Response data:', data);
      } catch (e) {
        console.log('Response is not JSON');
      }
    } else {
      console.log('Basic API returned an error status code or is not reachable');
    }
    
    // Test worker API endpoint
    console.log('\nTesting worker API endpoint...');
    const workerResponse = await fetch(`${API_URL}/api/jobs/worker?maxJobs=1&mode=single`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }).catch(error => {
      console.error('Network error:', error.message);
      return { ok: false, status: 'network error' };
    });
    
    console.log(`Worker API response status: ${workerResponse.status || 'unknown'}`);
    
    if (workerResponse.ok) {
      console.log('Worker API is reachable!');
      try {
        const data = await workerResponse.json();
        console.log('Response data:', data);
      } catch (e) {
        console.log('Response is not JSON');
      }
    } else {
      console.log('Worker API returned an error status code or is not reachable');
    }
    
    // Test job queue
    console.log('\nTesting job queue status...');
    const jobsResponse = await fetch(`${API_URL}/api/jobs/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WORKER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }).catch(error => {
      console.error('Network error:', error.message);
      return { ok: false, status: 'network error' };
    });
    
    console.log(`Jobs API response status: ${jobsResponse.status || 'unknown'}`);
    
    if (jobsResponse.ok) {
      console.log('Jobs API is reachable!');
      try {
        const data = await jobsResponse.json();
        console.log('Response data:', data);
      } catch (e) {
        console.log('Response is not JSON');
      }
    } else {
      console.log('Jobs API returned an error status code or is not reachable');
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

// Run the test
testAPI(); 