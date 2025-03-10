-- Epic 7: Audio Format Standardization Implementation - Migration Script
-- This script adds the transcription_formats JSONB column to the audio_files table

-- Add transcription formats storage
ALTER TABLE audio_files
ADD COLUMN transcription_formats JSONB DEFAULT '{}';

-- Add index for efficient queries
CREATE INDEX idx_audio_files_transcription_formats ON audio_files USING gin (transcription_formats);

-- Add comment to document the schema
COMMENT ON COLUMN audio_files.transcription_formats IS 'JSONB object containing information about transcription-optimized formats for different services';

-- Example structure of the transcription_formats column:
/*
{
  "whisper": {
    "path": "audio/user-id/transcription/filename.wav",
    "format": "wav",
    "sample_rate": 16000,
    "channels": 1,
    "created_at": "2023-06-15T14:30:00Z"
  },
  "google": {
    "path": "audio/user-id/transcription/filename.flac",
    "format": "flac",
    "sample_rate": 44100,
    "channels": 2,
    "created_at": "2023-06-15T14:35:00Z"
  }
}
*/ 