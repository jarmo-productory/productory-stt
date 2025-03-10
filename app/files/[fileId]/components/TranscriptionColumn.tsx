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
import { TranscriptionRequest, TranscriptionView } from "@/app/components/files";
import { storagePathUtil } from "@/lib/utils/storage";
import { useAuth } from "@/contexts/AuthContext";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface TranscriptionColumnProps {
  file: FileObject | null;
}

export function TranscriptionColumn({ file }: TranscriptionColumnProps) {
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  
  // Check for existing transcription
  useEffect(() => {
    async function checkExistingTranscription() {
      if (!file) return;
      
      try {
        const { data, error } = await supabase
          .from('transcriptions')
          .select('id')
          .eq('file_id', file.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (data && !error) {
          setTranscriptionId(data.id);
        }
      } catch (error) {
        console.log('No existing transcription found');
      } finally {
        setIsLoading(false);
      }
    }
    
    checkExistingTranscription();
  }, [file, supabase]);
  
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
        
        // Try multiple path variations to find the correct one
        const pathVariations = [];
        
        // 1. Use the file_path directly if it includes the prefix
        if (filePath.startsWith('audio/')) {
          pathVariations.push(filePath);
        }
        
        // 2. Construct the path using StoragePathUtil
        const constructedPath = storagePathUtil.getAudioPath(user.id, filePath);
        pathVariations.push(constructedPath);
        
        // 3. Try with just the filename (in case it's stored at the root)
        const fileName = filePath.split('/').pop() || filePath;
        pathVariations.push(fileName);
        
        // 4. Try with just the user ID prefix
        pathVariations.push(`audio/${user.id}/${fileName}`);
        
        console.log('Trying path variations:', pathVariations);
        
        // Try each path variation until one works
        for (const path of pathVariations) {
          try {
            console.log('Trying path:', path);
            const { data, error } = await supabase
              .storage
              .from('audio-files')
              .createSignedUrl(path, 3600);
            
            if (!error && data) {
              setAudioUrl(data.signedUrl);
              console.log('Audio URL created successfully with path:', path);
              return;
            }
          } catch (e) {
            console.warn(`Failed with path ${path}:`, e);
          }
        }
        
        console.error('All path variations failed to create a signed URL');
      } catch (error) {
        console.error('Error creating signed URL:', error);
      }
    }
    
    getAudioUrl();
  }, [file, user, supabase]);
  
  // Handle transcription creation
  const handleTranscriptionCreated = (newTranscriptionId: string, newJobId: string) => {
    setTranscriptionId(newTranscriptionId);
    setJobId(newJobId);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center mb-4">
        <FileText className="h-5 w-5 mr-2 text-blue-500" />
        <h2 className="text-lg font-semibold">Transcription</h2>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : transcriptionId ? (
        <TranscriptionView 
          transcriptionId={transcriptionId} 
          audioUrl={audioUrl || undefined}
          className="w-full"
          jobId={jobId || undefined}
        />
      ) : (
        <TranscriptionRequest 
          fileId={file?.id || ''} 
          onTranscriptionCreated={handleTranscriptionCreated}
        />
      )}
    </div>
  );
} 