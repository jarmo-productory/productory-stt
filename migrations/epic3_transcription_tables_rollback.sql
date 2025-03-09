-- Epic 3: Transcription & AI Features - Rollback Migration
-- This script removes all tables, policies, and functions created for Epic 3

-- Drop triggers
DROP TRIGGER IF EXISTS set_timestamp_file_notes ON file_notes;
DROP TRIGGER IF EXISTS set_timestamp_transcriptions ON transcriptions;
DROP TRIGGER IF EXISTS set_timestamp_transcription_segments ON transcription_segments;

-- Drop function
DROP FUNCTION IF EXISTS update_timestamp();

-- Drop indexes
DROP INDEX IF EXISTS idx_file_notes_file_id;
DROP INDEX IF EXISTS idx_file_notes_user_id;
DROP INDEX IF EXISTS idx_transcriptions_file_id;
DROP INDEX IF EXISTS idx_transcriptions_status;
DROP INDEX IF EXISTS idx_transcription_segments_transcription_id;
DROP INDEX IF EXISTS idx_transcription_segments_speaker_id;
DROP INDEX IF EXISTS idx_transcription_segments_sequence_number;
DROP INDEX IF EXISTS idx_transcription_segments_time_range;
DROP INDEX IF EXISTS idx_ai_summaries_file_id;

-- Drop policies
DROP POLICY IF EXISTS "Users can view their own file notes" ON file_notes;
DROP POLICY IF EXISTS "Users can insert their own file notes" ON file_notes;
DROP POLICY IF EXISTS "Users can update their own file notes" ON file_notes;
DROP POLICY IF EXISTS "Users can delete their own file notes" ON file_notes;

DROP POLICY IF EXISTS "Users can view transcriptions for their files" ON transcriptions;
DROP POLICY IF EXISTS "Users can insert transcriptions for their files" ON transcriptions;
DROP POLICY IF EXISTS "Users can update transcriptions for their files" ON transcriptions;
DROP POLICY IF EXISTS "Users can delete transcriptions for their files" ON transcriptions;

DROP POLICY IF EXISTS "Users can view transcription segments for their files" ON transcription_segments;
DROP POLICY IF EXISTS "Users can insert transcription segments for their files" ON transcription_segments;
DROP POLICY IF EXISTS "Users can update transcription segments for their files" ON transcription_segments;
DROP POLICY IF EXISTS "Users can delete transcription segments for their files" ON transcription_segments;

DROP POLICY IF EXISTS "Users can view AI summaries for their files" ON ai_summaries;
DROP POLICY IF EXISTS "Users can insert AI summaries for their files" ON ai_summaries;
DROP POLICY IF EXISTS "Users can update AI summaries for their files" ON ai_summaries;
DROP POLICY IF EXISTS "Users can delete AI summaries for their files" ON ai_summaries;

-- Drop tables (in correct order to respect foreign key constraints)
DROP TABLE IF EXISTS transcription_segments;
DROP TABLE IF EXISTS transcriptions;
DROP TABLE IF EXISTS file_notes;
DROP TABLE IF EXISTS ai_summaries; 