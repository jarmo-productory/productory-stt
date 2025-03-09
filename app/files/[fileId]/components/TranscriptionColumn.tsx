'use client';

import { useState, useEffect } from 'react';
import { FileObject } from "@/contexts/FileContext";
import { 
  FileText,
  FileJson,
  Download
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TranscriptionRequest } from "@/app/components/files/TranscriptionRequest";
import { TranscriptionView } from "@/app/components/files/TranscriptionView";
import { storagePathUtil } from "@/lib/utils/storage";
import { useAuth } from "@/contexts/AuthContext";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface TranscriptionColumnProps {
  file: FileObject | null;
}

export function TranscriptionColumn({ file }: TranscriptionColumnProps) {
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  
  // Check if file has an existing transcription
  useEffect(() => {
    async function checkExistingTranscription() {
      if (!file) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/files/${file.id}/transcription`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.transcription) {
            setTranscriptionId(data.transcription.id);
            setJobId(data.job?.id || null);
          }
        }
      } catch (error) {
        console.error('Error checking for existing transcription:', error);
      } finally {
        setLoading(false);
      }
    }
    
    checkExistingTranscription();
  }, [file]);
  
  // Get audio URL from file
  useEffect(() => {
    async function getAudioUrl() {
      if (!file || !user) return;
      
      try {
        console.log('Getting audio URL for file:', file.id);
        
        // Try normalized_path first (preferred method)
        if (file.normalized_path) {
          console.log('Using normalized_path:', file.normalized_path);
          const { data, error } = await supabase
            .storage
            .from('audio-files')
            .createSignedUrl(file.normalized_path, 3600);
          
          if (!error) {
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
          console.error('File path is missing');
          return;
        }
        
        // Check if file_path already includes the prefix
        if (filePath.startsWith('audio/')) {
          console.log('Using full file_path:', filePath);
          // File path already includes the prefix, use it directly
          const { data, error } = await supabase
            .storage
            .from('audio-files')
            .createSignedUrl(filePath, 3600);
          
          if (!error) {
            setAudioUrl(data.signedUrl);
            console.log('Audio URL created using full file_path');
            return;
          } else {
            console.warn('Failed to create signed URL with full file_path:', error);
          }
        }
        
        // Fallback: Construct the path using StoragePathUtil
        console.log('Constructing path with StoragePathUtil');
        const audioPath = storagePathUtil.getAudioPath(user.id, filePath);
        console.log('Constructed audio path:', audioPath);
        
        // Generate a signed URL with the Supabase client
        const { data, error } = await supabase
          .storage
          .from('audio-files')
          .createSignedUrl(audioPath, 3600); // 1 hour expiry
        
        if (error) {
          console.error('Error creating signed URL:', error);
          return;
        }
        
        setAudioUrl(data.signedUrl);
        console.log('Audio URL created using constructed path');
      } catch (error) {
        console.error('Error getting audio URL:', error);
      }
    }
    
    getAudioUrl();
  }, [file, user, supabase]);
  
  const handleTranscriptionCreated = (newTranscriptionId: string, newJobId: string) => {
    setTranscriptionId(newTranscriptionId);
    setJobId(newJobId);
  };
  
  if (!file) {
    return <div className="p-4">No file selected</div>;
  }
  
  return (
    <div className="border rounded-lg p-4 bg-card h-full flex flex-col">
      <h2 className="text-lg font-medium mb-4">Transcription</h2>
      
      <div className="space-y-4 flex-1 flex flex-col">
        {/* Show TranscriptionRequest if no transcription exists */}
        {!loading && !transcriptionId && (
          <TranscriptionRequest 
            fileId={file.id} 
            onTranscriptionCreated={handleTranscriptionCreated}
            className="flex-1"
          />
        )}
        
        {/* Show TranscriptionView if transcription exists */}
        {!loading && transcriptionId && (
          <TranscriptionView 
            transcriptionId={transcriptionId}
            audioUrl={audioUrl}
            className="flex-1"
          />
        )}
      </div>
    </div>
  );
} 