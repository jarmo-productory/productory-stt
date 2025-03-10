'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { useAuth } from "@/contexts/AuthContext";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { TranscriptionRequest, TranscriptionView } from "@/app/components/files";
import { useAudioPlayer } from "@/app/contexts/AudioPlayerContext";

// Define FileObject interface locally if it's not available from a module
interface FileObject {
  id: string;
  file_name: string;
  file_path: string;
  normalized_path?: string;
  user_id: string;
  [key: string]: any;
}

interface TranscriptionColumnProps {
  file: FileObject | null;
}

export function TranscriptionColumn({ file }: TranscriptionColumnProps) {
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transcriptionFormats, setTranscriptionFormats] = useState<any>(null);
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  const { setAudioUrl } = useAudioPlayer();
  
  // Fetch transcription formats when file is available
  useEffect(() => {
    async function fetchTranscriptionFormats() {
      if (!file) return;
      
      try {
        const { data, error } = await supabase
          .from('audio_files')
          .select('transcription_formats')
          .eq('id', file.id)
          .single();
        
        if (error) {
          console.error('Error fetching transcription formats:', error);
          return;
        }
        
        if (data && data.transcription_formats) {
          console.log('Fetched transcription formats:', data.transcription_formats);
          setTranscriptionFormats(data.transcription_formats);
        }
      } catch (error) {
        console.error('Error in fetchTranscriptionFormats:', error);
      }
    }
    
    fetchTranscriptionFormats();
  }, [file, supabase]);
  
  // Check for existing transcription
  useEffect(() => {
    async function checkExistingTranscription() {
      if (!file) {
        setIsLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('transcriptions')
          .select('id, status')
          .eq('file_id', file.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error) {
          console.error('Error checking for existing transcription:', error);
          setIsLoading(false);
          return;
        }
        
        if (data) {
          console.log('Found existing transcription:', data);
          setTranscriptionId(data.id);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error in checkExistingTranscription:', error);
        setIsLoading(false);
      }
    }
    
    checkExistingTranscription();
  }, [file, supabase]);
  
  // Get audio file details including transcription formats
  useEffect(() => {
    async function getAudioFileDetails() {
      if (!file || !user) return;
      
      try {
        console.log('Getting audio file details for file:', file.id);
        
        // Get the file details including transcription_formats
        const { data: fileData, error: fileError } = await supabase
          .from('audio_files')
          .select('transcription_formats')
          .eq('id', file.id)
          .single();
        
        if (fileError) {
          console.error('Error fetching file details:', fileError);
        } else if (fileData) {
          console.log('File details fetched:', fileData);
          setTranscriptionFormats(fileData.transcription_formats);
        }
      } catch (error) {
        console.error('Error in getAudioFileDetails:', error);
      }
    }
    
    getAudioFileDetails();
  }, [file, user, supabase]);
  
  // Get audio URL from file
  useEffect(() => {
    async function getAudioUrl() {
      if (!file || !user) return;
      
      try {
        console.log('Getting audio URL for file:', file.id);
        
        // Check for optimized format first
        if (transcriptionFormats?.optimized?.path) {
          console.log('Using optimized format path:', transcriptionFormats.optimized.path);
          const { data, error } = await supabase
            .storage
            .from('audio-files')
            .createSignedUrl(transcriptionFormats.optimized.path, 3600);
          
          if (!error && data) {
            setAudioUrl(data.signedUrl);
            console.log('Audio URL created using optimized format');
            return;
          } else {
            console.warn('Failed to create signed URL with optimized format:', error);
          }
        }
        
        // Try normalized_path next (preferred method)
        if (file.normalized_path) {
          console.log('Using normalized_path:', file.normalized_path);
          const { data, error } = await supabase
            .storage
            .from('audio-files')
            .createSignedUrl(file.normalized_path, 3600);
          
          if (!error && data) {
            setAudioUrl(data.signedUrl);
            console.log('Audio URL created using normalized_path');
            return;
          } else {
            console.warn('Failed to create signed URL with normalized_path:', error);
          }
        }
        
        // Get the file path from the database
        const filePath = file.file_path;
        
        if (!filePath) {
          console.error('No file path available');
          return;
        }
        
        console.log('Using file_path:', filePath);
        const { data, error } = await supabase
          .storage
          .from('audio-files')
          .createSignedUrl(filePath, 3600);
        
        if (error || !data) {
          console.error('Error creating signed URL:', error);
          return;
        }
        
        setAudioUrl(data.signedUrl);
        console.log('Audio URL created using file_path');
      } catch (error) {
        console.error('Error in getAudioUrl:', error);
      }
    }
    
    getAudioUrl();
  }, [file, user, supabase, transcriptionFormats, setAudioUrl]);
  
  const handleTranscriptionCreated = (newTranscriptionId: string) => {
    console.log('Transcription created:', newTranscriptionId);
    setTranscriptionId(newTranscriptionId);
  };
  
  return (
    <div className="space-y-4">
      {!transcriptionId && !isLoading && (
        <TranscriptionRequest 
          fileId={file?.id || ''} 
          onTranscriptionCreated={handleTranscriptionCreated} 
        />
      )}
      
      {transcriptionId && (
        <TranscriptionView 
          transcriptionId={transcriptionId} 
          className="w-full"
          transcriptionFormats={transcriptionFormats}
        />
      )}
    </div>
  );
} 