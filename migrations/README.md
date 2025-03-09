# Database Migrations

This directory contains SQL migration scripts for the Productory STT application.

## Epic 3: Transcription & AI Features

### Migration Files

- `epic3_transcription_tables.sql`: Creates the tables, RLS policies, and indexes for Epic 3
- `epic3_transcription_tables_rollback.sql`: Rollback script to revert the Epic 3 database changes

### Tables Created

1. **file_notes**: Stores user notes associated with audio files
2. **transcriptions**: Stores metadata about transcriptions
3. **transcription_segments**: Stores individual segments of transcriptions with timing information
4. **ai_summaries**: Stores AI-generated summaries of audio files

### How to Apply Migrations

To apply the migrations to your Supabase project:

1. Navigate to the Supabase dashboard
2. Go to the SQL Editor
3. Copy the contents of the migration file
4. Paste into the SQL Editor
5. Execute the SQL script

### How to Rollback Migrations

If you need to rollback the migrations:

1. Navigate to the Supabase dashboard
2. Go to the SQL Editor
3. Copy the contents of the rollback file
4. Paste into the SQL Editor
5. Execute the SQL script

## Database Schema Overview

### file_notes
- `id`: UUID primary key
- `file_id`: Reference to audio_files table
- `user_id`: Reference to auth.users table
- `content`: Text content of the note
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

### transcriptions
- `id`: UUID primary key
- `file_id`: Reference to audio_files table
- `status`: Status of the transcription (pending, processing, completed, failed)
- `language`: Detected language code
- `language_probability`: Confidence score for language detection
- `raw_text`: Full text of the transcription
- `model_id`: ID of the model used for transcription
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

### transcription_segments
- `id`: UUID primary key
- `transcription_id`: Reference to transcriptions table
- `start_time`: Start time of the segment in seconds
- `end_time`: End time of the segment in seconds
- `speaker_id`: ID of the speaker (for diarization)
- `text`: Text content of the segment
- `original_text`: Original unedited text (preserved for reference)
- `type`: Type of segment (word, sentence, etc.)
- `sequence_number`: Order of the segment in the transcription
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

### ai_summaries
- `id`: UUID primary key
- `file_id`: Reference to audio_files table
- `summary_text`: Text content of the AI-generated summary
- `model_used`: ID of the model used for summary generation
- `created_at`: Timestamp of creation 