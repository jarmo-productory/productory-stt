-- Epic 7: Audio Format Standardization Implementation - Rollback Script
-- This script removes the transcription_formats column from the audio_files table

-- Drop the index first
DROP INDEX IF EXISTS idx_audio_files_transcription_formats;

-- Remove the column
ALTER TABLE audio_files
DROP COLUMN IF EXISTS transcription_formats; 