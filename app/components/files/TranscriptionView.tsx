'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';
import { JobStatus } from '@/app/components/jobs/JobStatus';

export type TranscriptionViewProps = {
  transcriptionId: string;
  audioUrl?: string;
  className?: string;
  transcriptionFormats?: {
    optimized?: {
      path: string;
      format: string;
      sample_rate: number;
      channels: number;
    }
  };
};

type TranscriptionSegment = {
  id: string;
  transcription_id: string;
  start_time: number | string;
  end_time: number | string;
  text: string;
  original_text?: string;
  speaker_id?: string;
  type?: string;
  sequence_number: number;
  created_at: string;
  updated_at: string;
};

type Transcription = {
  id: string;
  file_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  language?: string;
  language_probability?: number;
  raw_text?: string;
  model_id?: string;
  created_at: string;
  updated_at: string;
  segments: TranscriptionSegment[];
  metadata?: {
    duration?: number;
    language?: string;
    model?: string;
    word_count?: number;
    processing_time?: number;
  };
  error_message?: string;
};

// Helper function to convert time values to numbers
const toNumber = (value: string | number): number => {
  if (typeof value === 'number') return value;
  return parseFloat(value);
};

export function TranscriptionView({
  transcriptionId,
  audioUrl,
  className,
  transcriptionFormats,
}: TranscriptionViewProps) {
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [shouldPoll, setShouldPoll] = useState(false);
  
  // Initial data fetch - only runs once
  useEffect(() => {
    async function fetchInitialData() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/transcriptions/${transcriptionId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch transcription: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const transcriptionData = {
          ...data.transcription,
          segments: data.segments || []
        };
        
        setTranscription(transcriptionData);
        
        // Check if we need to fetch job status and set up polling
        if (transcriptionData.status === 'pending' || transcriptionData.status === 'processing') {
          setShouldPoll(true);
          await fetchJobInfo(transcriptionId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching transcription:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchInitialData();
  }, [transcriptionId]);
  
  // Separate function to fetch job info
  async function fetchJobInfo(transcriptionId: string) {
    try {
      const jobResponse = await fetch(`/api/jobs?transcription_id=${transcriptionId}`);
      
      if (!jobResponse.ok) {
        console.warn(`Job fetch failed with status: ${jobResponse.status}`);
        return;
      }
      
      const jobData = await jobResponse.json();
      
      if (jobData.jobs && jobData.jobs.length > 0) {
        setJobId(jobData.jobs[0].id);
      }
    } catch (jobErr) {
      console.error('Error fetching job information:', jobErr);
    }
  }
  
  // Separate polling effect for status updates only
  useEffect(() => {
    if (!shouldPoll) return;
    
    // Function to check transcription status without updating UI state
    async function pollTranscriptionStatus() {
      try {
        const response = await fetch(`/api/transcriptions/${transcriptionId}`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        const newStatus = data.transcription.status;
        
        // Only update the state if the status has changed
        if (transcription && transcription.status !== newStatus) {
          console.log(`Transcription status changed from ${transcription.status} to ${newStatus}`);
          
          // If completed or failed, stop polling and update the full transcription
          if (newStatus === 'completed' || newStatus === 'failed') {
            setShouldPoll(false);
            setTranscription({
              ...data.transcription,
              segments: data.segments || []
            });
          } else {
            // Just update the status without changing the whole object
            setTranscription(prev => prev ? { ...prev, status: newStatus } : null);
          }
        }
      } catch (err) {
        console.error('Error polling transcription status:', err);
      }
    }
    
    const intervalId = setInterval(pollTranscriptionStatus, 5000);
    return () => clearInterval(intervalId);
  }, [transcriptionId, shouldPoll, transcription?.status]);
  
  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error || !transcription) {
    return (
      <div className={`p-4 border border-red-200 rounded-md bg-red-50 ${className}`}>
        <p className="text-red-700">
          {error || 'Failed to load transcription'}
        </p>
      </div>
    );
  }
  
  // Show JobStatus for pending or processing transcriptions
  if (transcription.status === 'pending' || transcription.status === 'processing') {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="mt-4 p-4 border rounded-md bg-blue-50 border-blue-200">
          <h3 className="text-lg font-medium mb-2">Transcription in Progress</h3>
          <p className="text-sm text-gray-600 mb-4">
            Your audio is being transcribed. This may take a few minutes depending on the length of the audio.
          </p>
          
          {jobId ? (
            <JobStatus 
              jobId={jobId} 
              autoRefresh={true}
              pollingInterval={3000}
              className="mt-2"
            />
          ) : (
            <div className="flex items-center space-x-2 text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{transcription.status === 'pending' ? 'Waiting in queue...' : 'Processing your audio...'}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Get language from either metadata or direct property
  const language = transcription.metadata?.language || transcription.language || 'Unknown';
  
  // Calculate duration from either metadata or last segment
  const calculatedDuration = transcription.metadata?.duration || 
    (transcription.segments.length > 0 ? 
      toNumber(transcription.segments[transcription.segments.length - 1].end_time) : 0);
  
  // Calculate word count from either metadata or segments
  const wordCount = transcription.metadata?.word_count || 
    transcription.segments.reduce((count, segment) => count + segment.text.split(/\s+/).length, 0);
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Transcription metadata */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline">
          {language.toUpperCase()}
        </Badge>
        <Badge variant="outline">
          {wordCount} words
        </Badge>
        <Badge variant="outline">
          {formatDuration(calculatedDuration)}
        </Badge>
      </div>
      
      {/* Transcription segments */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
        {transcription.segments.map((segment) => {
          const startTime = toNumber(segment.start_time);
          const endTime = toNumber(segment.end_time);
          const speakerId = segment.speaker_id ? String(segment.speaker_id) : null;
          
          return (
            <div 
              key={segment.id}
              className={`p-3 rounded-md mb-2 cursor-pointer transition-colors`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground">
                  {formatDuration(startTime)} - {formatDuration(endTime)}
                </span>
                
                {speakerId && (
                  <div className="inline-flex items-center border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-full">
                    {speakerId}
                  </div>
                )}
              </div>
              <p className="text-sm">{segment.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
} 