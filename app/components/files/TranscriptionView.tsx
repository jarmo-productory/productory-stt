'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';
import { JobStatus } from '@/app/components/jobs/JobStatus';
import React from 'react';
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext';

export type TranscriptionViewProps = {
  transcriptionId: string;
  className?: string;
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

// Helper function to format timestamp for inline display (M:SS)
const formatInlineTimestamp = (seconds: number): string => {
  if (isNaN(seconds)) return '(0:00)';
  
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `(${minutes}:${secs.toString().padStart(2, '0')})`;
};

// Group segments by speaker
type GroupedSegment = {
  speakerId: string;
  segments: TranscriptionSegment[];
};

const groupSegmentsBySpeaker = (segments: TranscriptionSegment[]): GroupedSegment[] => {
  const result: GroupedSegment[] = [];
  let currentGroup: GroupedSegment | null = null;
  
  segments.forEach(segment => {
    const speakerId = segment.speaker_id || 'unknown';
    
    if (!currentGroup || currentGroup.speakerId !== speakerId) {
      currentGroup = {
        speakerId,
        segments: [segment]
      };
      result.push(currentGroup);
    } else {
      currentGroup.segments.push(segment);
    }
  });
  
  return result;
};

// Component to render a speaker's segments
const SpeakerSegment = ({ 
  speakerId, 
  segments,
  onSegmentClick,
  activeSegmentId
}: GroupedSegment & { 
  onSegmentClick?: (segmentId: string, startTime: number) => void,
  activeSegmentId?: string | null
}) => {
  // Generate speaker label (Speaker 1, Speaker 2, etc.)
  const speakerLabel = speakerId === 'unknown' 
    ? 'Unknown Speaker' 
    : `Speaker ${speakerId}`;
  
  // Create refs for active segments
  const segmentRefs = useMemo(() => {
    const refs: { [key: string]: React.RefObject<HTMLParagraphElement | null> } = {};
    segments.forEach(segment => {
      refs[segment.id] = React.createRef<HTMLParagraphElement | null>();
    });
    return refs;
  }, [segments]);
  
  // Scroll to active segment when it changes
  useEffect(() => {
    if (activeSegmentId && segmentRefs[activeSegmentId]?.current) {
      segmentRefs[activeSegmentId].current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeSegmentId, segmentRefs]);
  
  return (
    <div className="mb-4">
      {/* Speaker header - more subtle as a subheading */}
      <h3 className="text-base font-medium text-gray-700 mb-1">{speakerLabel}</h3>
      
      {/* Speaker's segments - flowing like a normal document */}
      <div className="pl-0">
        {segments.map((segment, index) => {
          const startTime = toNumber(segment.start_time);
          const inlineTimestamp = formatInlineTimestamp(startTime);
          const isActive = activeSegmentId === segment.id;
          
          // Add data attributes for audio player integration
          return (
            <p 
              key={segment.id} 
              ref={segmentRefs[segment.id]}
              className={`
                ${index > 0 ? 'mt-2' : ''} 
                ${isActive ? 'bg-yellow-100 border-l-4 border-yellow-500 pl-2' : ''} 
                ${onSegmentClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                relative transition-all duration-200 ease-in-out rounded-sm
              `}
              data-start-time={startTime}
              data-end-time={toNumber(segment.end_time)}
              data-segment-id={segment.id}
              onClick={() => onSegmentClick?.(segment.id, startTime)}
            >
              <span className="text-gray-400 font-normal mr-1">{inlineTimestamp}</span>
              {segment.text}
            </p>
          );
        })}
      </div>
    </div>
  );
};

export function TranscriptionView({
  transcriptionId,
  className,
}: TranscriptionViewProps) {
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [shouldPoll, setShouldPoll] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  
  // Get audio player context
  const { seekTo, play, setActiveSegment, currentTime } = useAudioPlayer();
  
  // Enhanced segment click handler
  const handleSegmentClick = (segmentId: string, startTime: number) => {
    setActiveSegmentId(segmentId);
    setActiveSegment(segmentId);
    
    // Seek to the segment's start time and play
    seekTo(startTime);
    play();
  };
  
  // Find and highlight the current segment based on audio playback time
  useEffect(() => {
    if (!transcription?.segments || !currentTime) return;
    
    // Find the segment that corresponds to the current playback time
    const currentSegment = transcription.segments.find(segment => {
      const startTime = toNumber(segment.start_time);
      const endTime = toNumber(segment.end_time);
      return currentTime >= startTime && currentTime < endTime;
    });
    
    if (currentSegment && currentSegment.id !== activeSegmentId) {
      setActiveSegmentId(currentSegment.id);
      setActiveSegment(currentSegment.id);
    }
  }, [currentTime, transcription?.segments, activeSegmentId, setActiveSegment]);
  
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
  
  // Group segments by speaker
  const groupedSegments = useMemo(() => {
    if (!transcription || !transcription.segments) return [];
    return groupSegmentsBySpeaker(transcription.segments);
  }, [transcription]);
  
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
      
      {/* Enhanced transcription display - full height with natural text flow */}
      <div className="overflow-y-auto pr-2" style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}>
        {groupedSegments.length > 0 ? (
          <div className="space-y-6">
            {groupedSegments.map((group, index) => (
              <SpeakerSegment 
                key={`${group.speakerId}-${index}`}
                speakerId={group.speakerId}
                segments={group.segments}
                onSegmentClick={handleSegmentClick}
                activeSegmentId={activeSegmentId}
              />
            ))}
          </div>
        ) : (
          <div className="p-4 border rounded-md bg-gray-50">
            <p className="text-gray-500">No transcription segments available.</p>
          </div>
        )}
      </div>
    </div>
  );
} 