import { 
  getNextPendingJob, 
  updateJobStatus, 
  addJobLog, 
  incrementJobAttempts,
  Job,
  JobStatus,
  TranscriptionJobPayload
} from './jobs';
import { processTranscription } from './transcriptions';

/**
 * Processes a transcription job
 * @param job The job to process
 */
async function processTranscriptionJob(job: Job): Promise<void> {
  try {
    // Log job start
    await addJobLog(job.id, `Starting transcription job for file ${(job.payload as TranscriptionJobPayload).fileId}`);
    
    // Update job status to processing
    await updateJobStatus(job.id, 'processing');
    
    // Extract job payload
    const payload = job.payload as TranscriptionJobPayload;
    
    // Process the transcription
    const result = await processTranscription(
      payload.fileId,
      payload.transcriptionId,
      payload.options
    );
    
    if (result.success) {
      // Update job status to completed
      await updateJobStatus(job.id, 'completed', {
        success: true,
        transcriptionId: payload.transcriptionId
      });
      
      // Log job completion
      await addJobLog(job.id, 'Transcription job completed successfully');
    } else {
      // Update job status to failed
      await updateJobStatus(job.id, 'failed', {
        success: false,
        transcriptionId: payload.transcriptionId,
        error: result.error
      }, result.error);
      
      // Log job failure
      await addJobLog(job.id, `Transcription job failed: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error processing transcription job:', error);
    
    // Increment job attempts
    const updatedJob = await incrementJobAttempts(job.id);
    
    // Determine next status based on attempts
    let nextStatus: JobStatus = 'failed';
    if (updatedJob.attempts < updatedJob.max_attempts) {
      nextStatus = 'retrying';
      
      // Log retry attempt
      await addJobLog(
        job.id, 
        `Retrying job (attempt ${updatedJob.attempts}/${updatedJob.max_attempts})`,
        'warning'
      );
    } else {
      // Log max attempts reached
      await addJobLog(
        job.id,
        `Job failed after ${updatedJob.attempts} attempts`,
        'error'
      );
    }
    
    // Update job status
    await updateJobStatus(
      job.id,
      nextStatus,
      {
        success: false,
        transcriptionId: (job.payload as TranscriptionJobPayload).transcriptionId,
        error: error instanceof Error ? error.message : String(error)
      },
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Processes a job based on its type
 * @param job The job to process
 */
async function processJob(job: Job): Promise<void> {
  try {
    switch (job.job_type) {
      case 'transcription':
        await processTranscriptionJob(job);
        break;
      case 'ai_summary':
        // TODO: Implement AI summary job processing
        await addJobLog(job.id, 'AI summary jobs not yet implemented', 'warning');
        await updateJobStatus(job.id, 'failed', undefined, 'AI summary jobs not yet implemented');
        break;
      default:
        await addJobLog(job.id, `Unknown job type: ${job.job_type}`, 'error');
        await updateJobStatus(job.id, 'failed', undefined, `Unknown job type: ${job.job_type}`);
    }
  } catch (error) {
    console.error('Error processing job:', error);
    
    // Update job status to failed
    await updateJobStatus(
      job.id,
      'failed',
      undefined,
      error instanceof Error ? error.message : String(error)
    );
    
    // Log error
    await addJobLog(
      job.id,
      `Error processing job: ${error instanceof Error ? error.message : String(error)}`,
      'error'
    );
  }
}

/**
 * Processes the next pending job in the queue
 * @returns True if a job was processed, false otherwise
 */
export async function processNextJob(): Promise<boolean> {
  try {
    // Get the next pending job
    const job = await getNextPendingJob();
    
    // If no job is available, return false
    if (!job) {
      return false;
    }
    
    // Process the job
    await processJob(job);
    
    // Return true to indicate a job was processed
    return true;
  } catch (error) {
    console.error('Error processing next job:', error);
    return false;
  }
}

/**
 * Runs the worker process
 * @param maxJobs Maximum number of jobs to process in one run
 * @param pollInterval Interval in milliseconds to poll for new jobs
 */
export async function runWorker(maxJobs: number = 10, pollInterval: number = 5000): Promise<void> {
  console.log('Starting worker process...');
  
  let jobsProcessed = 0;
  let hasMoreJobs = true;
  
  // Process jobs until we reach the maximum or run out of jobs
  while (jobsProcessed < maxJobs && hasMoreJobs) {
    hasMoreJobs = await processNextJob();
    
    if (hasMoreJobs) {
      jobsProcessed++;
      console.log(`Processed job ${jobsProcessed}/${maxJobs}`);
    }
  }
  
  console.log(`Worker finished. Processed ${jobsProcessed} jobs.`);
  
  // Schedule the next run
  setTimeout(() => runWorker(maxJobs, pollInterval), pollInterval);
} 