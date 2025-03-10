#!/usr/bin/env node

/**
 * Job Queue Worker Script
 * 
 * This script runs the worker process to handle background jobs.
 * It can be run as a standalone process or as a cron job.
 * 
 * Usage:
 *   node scripts/run-worker.js [options]
 * 
 * Options:
 *   --max-jobs <number>     Maximum number of jobs to process (default: 10)
 *   --poll-interval <ms>    Interval in milliseconds to poll for new jobs (default: 5000)
 *   --continuous            Run in continuous mode (keep running until stopped)
 *   --single-run            Process a single batch of jobs and exit (default)
 */

// Load environment variables
// require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const { performance } = require('perf_hooks');

const { createClient } = require('@supabase/supabase-js');
// const fetch = require('node-fetch');

// Handle node-fetch import for different Node.js versions
let fetch;
try {
  // For Node.js 18+ which has built-in fetch
  if (globalThis.fetch) {
    fetch = globalThis.fetch;
    console.log('Using built-in fetch');
  } else {
    // For older Node.js versions
    fetch = require('node-fetch');
    console.log('Using node-fetch package');
  }
} catch (error) {
  console.error('Error importing fetch:', error);
  process.exit(1);
}

// Configuration with defaults
const CONFIG = {
  maxJobs: parseInt(process.env.WORKER_MAX_JOBS || '10'),
  pollInterval: parseInt(process.env.WORKER_POLL_INTERVAL || '5000'),
  stuckJobThreshold: parseInt(process.env.WORKER_STUCK_JOB_THRESHOLD || '30'), // minutes
  maxRetries: parseInt(process.env.WORKER_MAX_RETRIES || '3'),
  healthCheckInterval: parseInt(process.env.WORKER_HEALTH_CHECK_INTERVAL || '60000'), // ms
  debug: true // Force debug mode on
};

// Logging utility
class WorkerLogger {
  constructor(context = {}) {
    this.context = context;
    this.startTime = performance.now();
  }

  formatMessage(level, message, extra = {}) {
    const timestamp = new Date().toISOString();
    const uptime = Math.round((performance.now() - this.startTime) / 1000);
    
    return JSON.stringify({
      timestamp,
      level,
      uptime: `${uptime}s`,
      message,
      worker_id: process.env.WORKER_ID || 'default',
      ...this.context,
      ...extra
    });
  }

  debug(message, extra = {}) {
    if (CONFIG.debug) {
      console.debug(this.formatMessage('DEBUG', message, extra));
    }
  }

  info(message, extra = {}) {
    console.log(this.formatMessage('INFO', message, extra));
  }

  warn(message, extra = {}) {
    console.warn(this.formatMessage('WARN', message, extra));
  }

  error(message, error, extra = {}) {
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

  metric(name, value, extra = {}) {
    console.log(this.formatMessage('METRIC', name, { value, ...extra }));
  }
}

// Worker state management
class WorkerState {
  constructor() {
    this.activeJobs = new Map();
    this.metrics = {
      jobsProcessed: 0,
      jobsSucceeded: 0,
      jobsFailed: 0,
      totalProcessingTime: 0
    };
    this.startTime = Date.now();
    this.healthy = true;
  }

  trackJob(jobId, startTime) {
    this.activeJobs.set(jobId, { startTime, status: 'processing' });
  }

  completeJob(jobId, success, duration) {
    this.activeJobs.delete(jobId);
    this.metrics.jobsProcessed++;
    this.metrics.totalProcessingTime += duration;
    
    if (success) {
      this.metrics.jobsSucceeded++;
    } else {
      this.metrics.jobsFailed++;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeJobs: this.activeJobs.size,
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      averageProcessingTime: this.metrics.jobsProcessed > 0 
        ? Math.round(this.metrics.totalProcessingTime / this.metrics.jobsProcessed) 
        : 0
    };
  }
}

// API client with retries and error handling
class WorkerAPI {
  constructor(baseUrl, apiKey, logger) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.logger = logger;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    this.logger.debug('Making API request', { url, method: options.method });

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`API request failed: ${response.status}`, new Error(errorText), {
          url,
          method: options.method,
          status: response.status,
          response: errorText
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      this.logger.debug('API request succeeded', { url, method: options.method, data });
      return data;
    } catch (error) {
      this.logger.error(`API request to ${endpoint} failed`, error, {
        url,
        method: options.method,
        error: error.message
      });
      throw error;
    }
  }

  async getJobs(maxJobs) {
    return this.request('/api/jobs/worker', {
      method: 'POST',
      body: JSON.stringify({ maxJobs, mode: 'batch' })
    });
  }

  async updateJob(jobId, status, result = null) {
    return this.request('/api/jobs/update', {
      method: 'POST',
      body: JSON.stringify({ jobId, status, result })
    });
  }

  async resetStuckJobs(maxTimeMinutes) {
    return this.request('/api/jobs/reset-stuck', {
      method: 'POST',
      body: JSON.stringify({ maxTimeMinutes })
    });
  }

  async healthCheck() {
    return this.request('/api/jobs/worker');
  }
}

// Main worker class
class Worker {
  constructor() {
    this.logger = new WorkerLogger();
    this.state = new WorkerState();
    this.api = new WorkerAPI(
      'http://localhost:3000',
      process.env.WORKER_API_KEY,
      this.logger
    );
    
    this.setupShutdown();
  }

  setupShutdown() {
    let shuttingDown = false;

    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;

      this.logger.info(`Received ${signal}, shutting down gracefully...`, {
        active_jobs: this.state.activeJobs.size
      });

      // Wait for active jobs to complete (with timeout)
      const timeout = setTimeout(() => {
        this.logger.warn('Shutdown timeout reached, forcing exit');
        process.exit(1);
      }, 30000);

      while (this.state.activeJobs.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.logger.info('Waiting for jobs to complete...', {
          remaining_jobs: this.state.activeJobs.size
        });
      }

      clearTimeout(timeout);
      this.logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async processJob(job) {
    const startTime = performance.now();
    this.state.trackJob(job.id);

    try {
      this.logger.info('Processing job', { job_id: job.id, type: job.job_type });

      // Update job to processing status
      await this.api.updateJob(job.id, 'processing');

      // Process the job through the API
      const result = await this.api.request('/api/jobs/worker', {
        method: 'POST',
        body: JSON.stringify({ mode: 'single', jobId: job.id })
      });

      const duration = performance.now() - startTime;
      this.state.completeJob(job.id, true, duration);
      
      this.logger.info('Job completed successfully', {
        job_id: job.id,
        duration_ms: Math.round(duration)
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.state.completeJob(job.id, false, duration);

      this.logger.error('Job processing failed', error, { job_id: job.id });
      await this.api.updateJob(job.id, 'failed', { error: error.message });

      throw error;
    }
  }

  async checkHealth() {
    try {
      await this.api.healthCheck();
      this.state.healthy = true;
    } catch (error) {
      this.state.healthy = false;
      this.logger.error('Health check failed', error);
    }
  }

  async resetStuckJobs() {
    try {
      const result = await this.api.resetStuckJobs(CONFIG.stuckJobThreshold);
      if (result.resetCount > 0) {
        this.logger.info('Reset stuck jobs', { count: result.resetCount });
      }
    } catch (error) {
      this.logger.error('Failed to reset stuck jobs', error);
    }
  }

  async start() {
    this.logger.info('Worker starting', { config: CONFIG });

    // Initial health check
    await this.checkHealth();

    // Set up periodic health checks
    setInterval(() => this.checkHealth(), CONFIG.healthCheckInterval);

    // Set up stuck job detection
    setInterval(() => this.resetStuckJobs(), CONFIG.stuckJobThreshold * 60 * 1000);

    // Main job processing loop
    while (true) {
      try {
        if (!this.state.healthy) {
          this.logger.warn('Worker unhealthy, waiting for recovery');
          await new Promise(resolve => setTimeout(resolve, CONFIG.pollInterval));
          continue;
        }

        // Log metrics periodically
        this.logger.metric('worker_stats', this.state.getMetrics());

        // Get pending jobs
        const { jobs } = await this.api.getJobs(CONFIG.maxJobs);

        if (!jobs || jobs.length === 0) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.pollInterval));
          continue;
        }

        // Process jobs concurrently with limit
        await Promise.all(jobs.map(job => this.processJob(job)));

      } catch (error) {
        this.logger.error('Error in main processing loop', error);
        await new Promise(resolve => setTimeout(resolve, CONFIG.pollInterval));
      }
    }
  }
}

// Start the worker
if (require.main === module) {
  const worker = new Worker();
  worker.start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { Worker, WorkerLogger, WorkerState, WorkerAPI }; 