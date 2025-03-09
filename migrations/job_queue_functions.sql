-- Epic 3: Job Queue Functions - Database Migration
-- This script creates database functions for job queue operations

-- Function to increment job attempts
CREATE OR REPLACE FUNCTION increment_job_attempts(job_id UUID)
RETURNS SETOF job_queue AS $$
BEGIN
  RETURN QUERY
  UPDATE job_queue
  SET attempts = attempts + 1
  WHERE id = job_id
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- Function to get next pending job
CREATE OR REPLACE FUNCTION get_next_pending_job()
RETURNS SETOF job_queue AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM job_queue
  WHERE status = 'pending'
  ORDER BY priority DESC, created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql; 