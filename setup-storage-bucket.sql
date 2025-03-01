-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folders
CREATE POLICY "Users can upload files to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'audio-files' AND
  (storage.foldername(name))[1] = 'audio' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow authenticated users to select their own files
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'audio-files' AND
  (storage.foldername(name))[1] = 'audio' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'audio-files' AND
  (storage.foldername(name))[1] = 'audio' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'audio-files' AND
  (storage.foldername(name))[1] = 'audio' AND
  (storage.foldername(name))[2] = auth.uid()::text
); 