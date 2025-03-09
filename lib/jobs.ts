import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Job status types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

// Job types
export type JobType = 'transcription' | 'ai_summary';

// Job payload types
export type TranscriptionJobPayload = {
  fileId: string;
  transcriptionId: string;
  options: {
    language?: string;
    diarize?: boolean;
    numSpeakers?: number;
    timestampsGranularity?: 'word' | 'character' | 'none';
    tagAudioEvents?: boolean;
  };
};

export type AISummaryJobPayload = {
  fileId: string;
  transcriptionId: string;
  options?: {
    model?: string;
    maxLength?: number;
  };
};

// Union type for all job payloads
export type JobPayload = TranscriptionJobPayload | AISummaryJobPayload;

// Job result types
export type TranscriptionJobResult = {
  success: boolean;
  transcriptionId: string;
  error?: string;
};

export type AISummaryJobResult = {
  success: boolean;
  summaryId?: string;
  error?: string;
};

// Union type for all job results
export type JobResult = TranscriptionJobResult | AISummaryJobResult;

// Job interface
export interface Job {
  id: string;
  job_type: JobType;
  status: JobStatus;
  priority: number;
  payload: JobPayload;
  result?: JobResult;
  error_message?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  attempts: number;
  max_attempts: number;
  user_id: string;
}

/**
 * Creates a new job in the queue
 * @param jobType The type of job
 * @param payload The job payload
 * @param userId The user ID
 * @param priority The job priority (higher number = higher priority)
 * @returns The created job
 */
export async function createJob(
  jobType: JobType,
  payload: JobPayload,
  userId: string,
  priority: number = 0
): Promise<Job> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data, error } = await supabase
    .from('job_queue')
    .insert({
      job_type: jobType,
      status: 'pending',
      priority,
      payload,
      user_id: userId
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as Job;
}

/**
 * Gets a job by ID
 * @param jobId The job ID
 * @returns The job
 */
export async function getJob(jobId: string): Promise<Job | null> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data, error } = await supabase
    .from('job_queue')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data as Job;
}

/**
 * Updates a job's status
 * @param jobId The job ID
 * @param status The new status
 * @param result Optional result data
 * @param errorMessage Optional error message
 * @returns The updated job
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  result?: JobResult,
  errorMessage?: string
): Promise<Job> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const updates: any = { status };

  if (status === 'processing' && !updates.started_at) {
    updates.started_at = new Date().toISOString();
  }

  if (['completed', 'failed'].includes(status) && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
  }

  if (result) {
    updates.result = result;
  }

  if (errorMessage) {
    updates.error_message = errorMessage;
  }

  const { data, error } = await supabase
    .from('job_queue')
    .update(updates)
    .eq('id', jobId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as Job;
}

/**
 * Adds a log entry for a job
 * @param jobId The job ID
 * @param message The log message
 * @param level The log level
 */
export async function addJobLog(
  jobId: string,
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): Promise<void> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { error } = await supabase
    .from('job_logs')
    .insert({
      job_id: jobId,
      message,
      level
    });

  if (error) {
    console.error('Error adding job log:', error);
  }
}

/**
 * Gets the next pending job to process
 * @returns The next job to process, or null if no jobs are pending
 */
export async function getNextPendingJob(): Promise<Job | null> {
  // For this function, we need to use the service role client
  // as it needs to access jobs from all users
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('job_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data as Job;
}

/**
 * Increments the attempts counter for a job
 * @param jobId The job ID
 * @returns The updated job
 */
export async function incrementJobAttempts(jobId: string): Promise<Job> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc('increment_job_attempts', {
    job_id: jobId
  });

  if (error) {
    throw error;
  }

  return data as Job;
}

/**
 * Gets all jobs for a user
 * @param userId The user ID
 * @param status Optional status filter
 * @returns The jobs
 */
export async function getUserJobs(
  userId: string,
  status?: JobStatus
): Promise<Job[]> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  let query = supabase
    .from('job_queue')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data as Job[];
}

/**
 * Gets job logs for a job
 * @param jobId The job ID
 * @returns The job logs
 */
export async function getJobLogs(jobId: string): Promise<any[]> {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data, error } = await supabase
    .from('job_logs')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
} 