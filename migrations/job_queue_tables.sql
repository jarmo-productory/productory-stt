-- Epic 3: Job Queue Tables - Database Migration
-- This script creates the necessary tables, RLS policies, and indexes for job queue

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Job Queue Table
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Job Logs Table
CREATE TABLE IF NOT EXISTS job_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES job_queue(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  level VARCHAR(20) NOT NULL DEFAULT 'info',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for job_queue
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view their own jobs"
  ON job_queue FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own jobs
CREATE POLICY "Users can insert their own jobs"
  ON job_queue FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Service role can do everything
CREATE POLICY "Service role can do everything"
  ON job_queue
  USING (auth.role() = 'service_role');

-- RLS Policies for job_logs
ALTER TABLE job_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their own jobs
CREATE POLICY "Users can view logs for their own jobs"
  ON job_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM job_queue
    WHERE job_queue.id = job_logs.job_id
    AND job_queue.user_id = auth.uid()
  ));

-- Service role can do everything
CREATE POLICY "Service role can do everything"
  ON job_logs
  USING (auth.role() = 'service_role');

-- Create indexes for performance optimization
CREATE INDEX idx_job_queue_status ON job_queue(status);
CREATE INDEX idx_job_queue_type ON job_queue(job_type);
CREATE INDEX idx_job_queue_priority ON job_queue(priority);
CREATE INDEX idx_job_queue_user_id ON job_queue(user_id);
CREATE INDEX idx_job_logs_job_id ON job_logs(job_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_job_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_job_queue_timestamp
BEFORE UPDATE ON job_queue
FOR EACH ROW
EXECUTE FUNCTION update_job_queue_timestamp(); 