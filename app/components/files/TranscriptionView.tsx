'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';
import { AudioPlayer, AudioPlayerHandle } from '@/app/components/ui/audio-player';
import { JobStatus } from '@/app/components/jobs/JobStatus';

export type TranscriptionViewProps = {
  transcriptionId: string;
  audioUrl?: string;
  className?: string;
  jobId?: string;
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
  jobId,
}: TranscriptionViewProps) {
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [associatedJobId, setAssociatedJobId] = useState<string | null>(jobId || null);
  
  // Audio player state
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  
  // Fetch transcription data
  useEffect(() => {
    async function fetchTranscription() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/transcriptions/${transcriptionId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch transcription');
        }
        
        const data = await response.json();
        setTranscription({
          ...data.transcription,
          segments: data.segments || []
        });
        
        // If we don't have a jobId and the transcription is pending/processing,
        // try to fetch the associated job
        if (!associatedJobId && 
            data.transcription && 
            (data.transcription.status === 'pending' || data.transcription.status === 'processing')) {
          try {
            const jobResponse = await fetch(`/api/transcriptions/${transcriptionId}/job`);
            if (jobResponse.ok) {
              const jobData = await jobResponse.json();
              if (jobData.jobId) {
                setAssociatedJobId(jobData.jobId);
              } else {
                console.log('No job found for transcription, but continuing to display transcription');
              }
            } else {
              console.warn('Failed to fetch job data, but continuing to display transcription');
            }
          } catch (jobErr) {
            console.error('Error fetching associated job:', jobErr);
            // Don't set an error - we can still show the transcription
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching transcription:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchTranscription();
  }, [transcriptionId, associatedJobId]);
  
  // Handle time update from audio player
  const handleTimeUpdate = (currentTime: number) => {
    if (!transcription?.segments) return;
    
    // Find active segment
    const activeSegment = transcription.segments.find(
      segment => currentTime >= toNumber(segment.start_time) && currentTime <= toNumber(segment.end_time)
    );
    
    setActiveSegmentId(activeSegment?.id || null);
  };
  
  // Play segment
  const playSegment = (segment: TranscriptionSegment) => {
    if (!audioPlayerRef.current) {
      console.warn('Audio player not initialized');
      return;
    }
    
    const startTime = toNumber(segment.start_time);
    
    // Use the seekTo method we exposed via the ref
    audioPlayerRef.current.seekTo(startTime);
    
    // Start playing if not already playing
    audioPlayerRef.current.play().catch((err: Error) => {
      console.error('Error playing segment:', err);
      // No need to show an error message here as the AudioPlayer component will handle it
    });
  };
  
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
  
  if ((transcription.status === 'pending' || transcription.status === 'processing') && associatedJobId) {
    return (
      <JobStatus 
        jobId={associatedJobId}
        autoRefresh={true}
        pollingInterval={3000}
        className={className}
      />
    );
  }
  
  if (transcription.status === 'failed') {
    return (
      <div className={`p-4 border border-red-200 rounded-md bg-red-50 ${className}`}>
        <p className="text-red-700">
          Transcription failed: {transcription.error_message || 'Unknown error'}
        </p>
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
      
      {/* Audio player */}
      {audioUrl && (
        <AudioPlayer 
          audioUrl={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          ref={audioPlayerRef}
          lazyLoad={true}
        />
      )}
      
      {/* Transcription segments */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
        {transcription.segments.map((segment) => {
          const startTime = toNumber(segment.start_time);
          const endTime = toNumber(segment.end_time);
          const isActive = segment.id === activeSegmentId;
          const speakerId = segment.speaker_id ? String(segment.speaker_id) : null;
          
          return (
            <div 
              key={segment.id}
              className={`p-3 rounded-md mb-2 cursor-pointer transition-colors ${
                isActive 
                  ? 'bg-primary/10 border border-primary/30' 
                  : 'hover:bg-muted/50 border border-transparent'
              }`}
              onClick={() => playSegment(segment)}
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