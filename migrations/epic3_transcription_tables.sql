-- Epic 3: Transcription & AI Features - Database Migration
-- This script creates the necessary tables, RLS policies, and indexes for Epic 3

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. File Notes Table
CREATE TABLE IF NOT EXISTS file_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(file_id, user_id)
);

-- 2. Transcriptions Table
CREATE TABLE IF NOT EXISTS transcriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  language VARCHAR(10) DEFAULT 'en',
  language_probability DECIMAL(5, 4),
  raw_text TEXT,
  model_id VARCHAR(100) DEFAULT 'scribe_v1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(file_id)
);

-- 3. Transcription Segments Table
CREATE TABLE IF NOT EXISTS transcription_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transcription_id UUID NOT NULL REFERENCES transcriptions(id) ON DELETE CASCADE,
  start_time DECIMAL(10, 3) NOT NULL,
  end_time DECIMAL(10, 3) NOT NULL,
  speaker_id VARCHAR(100),
  text TEXT NOT NULL,
  original_text TEXT,
  type VARCHAR(20) DEFAULT 'word',
  sequence_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (end_time > start_time),
  UNIQUE(transcription_id, sequence_number)
);

-- 4. AI Summaries Table
CREATE TABLE IF NOT EXISTS ai_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  model_used VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(file_id)
);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE file_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcription_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

-- File Notes RLS Policies
CREATE POLICY "Users can view their own file notes"
  ON file_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own file notes"
  ON file_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own file notes"
  ON file_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own file notes"
  ON file_notes FOR DELETE
  USING (auth.uid() = user_id);

-- Transcriptions RLS Policies
-- Users can view transcriptions for files they own
CREATE POLICY "Users can view transcriptions for their files"
  ON transcriptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM audio_files
    WHERE audio_files.id = transcriptions.file_id
    AND audio_files.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert transcriptions for their files"
  ON transcriptions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM audio_files
    WHERE audio_files.id = file_id
    AND audio_files.user_id = auth.uid()
  ));

CREATE POLICY "Users can update transcriptions for their files"
  ON transcriptions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM audio_files
    WHERE audio_files.id = transcriptions.file_id
    AND audio_files.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM audio_files
    WHERE audio_files.id = file_id
    AND audio_files.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete transcriptions for their files"
  ON transcriptions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM audio_files
    WHERE audio_files.id = transcriptions.file_id
    AND audio_files.user_id = auth.uid()
  ));

-- Transcription Segments RLS Policies
-- Users can view segments for transcriptions of files they own
CREATE POLICY "Users can view transcription segments for their files"
  ON transcription_segments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM transcriptions
    JOIN audio_files ON audio_files.id = transcriptions.file_id
    WHERE transcriptions.id = transcription_segments.transcription_id
    AND audio_files.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert transcription segments for their files"
  ON transcription_segments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM transcriptions
    JOIN audio_files ON audio_files.id = transcriptions.file_id
    WHERE transcriptions.id = transcription_id
    AND audio_files.user_id = auth.uid()
  ));

CREATE POLICY "Users can update transcription segments for their files"
  ON transcription_segments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM transcriptions
    JOIN audio_files ON audio_files.id = transcriptions.file_id
    WHERE transcriptions.id = transcription_segments.transcription_id
    AND audio_files.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM transcriptions
    JOIN audio_files ON audio_files.id = transcriptions.file_id
    WHERE transcriptions.id = transcription_id
    AND audio_files.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete transcription segments for their files"
  ON transcription_segments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM transcriptions
    JOIN audio_files ON audio_files.id = transcriptions.file_id
    WHERE transcriptions.id = transcription_segments.transcription_id
    AND audio_files.user_id = auth.uid()
  ));

-- AI Summaries RLS Policies
CREATE POLICY "Users can view AI summaries for their files"
  ON ai_summaries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM audio_files
    WHERE audio_files.id = ai_summaries.file_id
    AND audio_files.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert AI summaries for their files"
  ON ai_summaries FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM audio_files
    WHERE audio_files.id = file_id
    AND audio_files.user_id = auth.uid()
  ));

CREATE POLICY "Users can update AI summaries for their files"
  ON ai_summaries FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM audio_files
    WHERE audio_files.id = ai_summaries.file_id
    AND audio_files.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM audio_files
    WHERE audio_files.id = file_id
    AND audio_files.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete AI summaries for their files"
  ON ai_summaries FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM audio_files
    WHERE audio_files.id = ai_summaries.file_id
    AND audio_files.user_id = auth.uid()
  ));

-- Create indexes for performance optimization
-- Indexes for file_notes
CREATE INDEX idx_file_notes_file_id ON file_notes(file_id);
CREATE INDEX idx_file_notes_user_id ON file_notes(user_id);

-- Indexes for transcriptions
CREATE INDEX idx_transcriptions_file_id ON transcriptions(file_id);
CREATE INDEX idx_transcriptions_status ON transcriptions(status);

-- Indexes for transcription_segments
CREATE INDEX idx_transcription_segments_transcription_id ON transcription_segments(transcription_id);
CREATE INDEX idx_transcription_segments_speaker_id ON transcription_segments(speaker_id);
CREATE INDEX idx_transcription_segments_sequence_number ON transcription_segments(transcription_id, sequence_number);
CREATE INDEX idx_transcription_segments_time_range ON transcription_segments(transcription_id, start_time, end_time);

-- Indexes for ai_summaries
CREATE INDEX idx_ai_summaries_file_id ON ai_summaries(file_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER set_timestamp_file_notes
BEFORE UPDATE ON file_notes
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER set_timestamp_transcriptions
BEFORE UPDATE ON transcriptions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER set_timestamp_transcription_segments
BEFORE UPDATE ON transcription_segments
FOR EACH ROW
EXECUTE FUNCTION update_timestamp(); 