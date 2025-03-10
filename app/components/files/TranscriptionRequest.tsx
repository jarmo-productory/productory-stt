'use client';

import { useState } from 'react';
import { Loader2, FileAudio, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobStatus } from '@/app/components/jobs/JobStatus';

export type TranscriptionRequestProps = {
  fileId: string;
  onTranscriptionCreated?: (transcriptionId: string) => void;
  className?: string;
};

export function TranscriptionRequest({
  fileId,
  onTranscriptionCreated,
  className,
}: TranscriptionRequestProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  
  // Transcription options
  const [language, setLanguage] = useState('en');
  const [diarize, setDiarize] = useState(true);
  const [numSpeakers, setNumSpeakers] = useState(2);
  const [timestampsGranularity, setTimestampsGranularity] = useState<'word' | 'character' | 'none'>('word');
  const [tagAudioEvents, setTagAudioEvents] = useState(true);
  
  const requestTranscription = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      
      const response = await fetch(`/api/files/${fileId}/transcription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language,
          diarize,
          numSpeakers: diarize ? numSpeakers : undefined,
          timestampsGranularity,
          tagAudioEvents,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to request transcription');
      }
      
      setSuccess(true);
      setJobId(data.job.id);
      
      if (onTranscriptionCreated) {
        onTranscriptionCreated(data.transcription.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error requesting transcription:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (jobId) {
    return (
      <div className={className}>
        <JobStatus 
          jobId={jobId} 
          autoRefresh={true}
          pollingInterval={3000}
        />
      </div>
    );
  }
  
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <FileAudio className="h-5 w-5 mr-2" />
          Request Transcription
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-2 border border-red-200 rounded-md bg-red-50 text-red-700 text-sm">
            <div className="flex items-center">
              <X className="h-4 w-4 mr-1" />
              <span>{error}</span>
            </div>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-2 border border-green-200 rounded-md bg-green-50 text-green-700 text-sm">
            <div className="flex items-center">
              <Check className="h-4 w-4 mr-1" />
              <span>Transcription request created successfully!</span>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select value={language} onValueChange={(value) => setLanguage(value)}>
              <SelectTrigger id="language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="it">Italian</SelectItem>
                <SelectItem value="pt">Portuguese</SelectItem>
                <SelectItem value="nl">Dutch</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
                <SelectItem value="ko">Korean</SelectItem>
                <SelectItem value="ru">Russian</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="diarize" className="cursor-pointer">Speaker Diarization</Label>
            <Switch
              id="diarize"
              checked={diarize}
              onCheckedChange={setDiarize}
            />
          </div>
          
          {diarize && (
            <div className="space-y-2">
              <Label htmlFor="numSpeakers">Number of Speakers</Label>
              <Select 
                value={numSpeakers.toString()} 
                onValueChange={(value) => setNumSpeakers(parseInt(value, 10))}
              >
                <SelectTrigger id="numSpeakers">
                  <SelectValue placeholder="Select number of speakers" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="timestampsGranularity">Timestamp Granularity</Label>
            <Select 
              value={timestampsGranularity} 
              onValueChange={(value) => setTimestampsGranularity(value as 'word' | 'character' | 'none')}
            >
              <SelectTrigger id="timestampsGranularity">
                <SelectValue placeholder="Select timestamp granularity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="word">Word</SelectItem>
                <SelectItem value="character">Character</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="tagAudioEvents" className="cursor-pointer">Tag Audio Events</Label>
            <Switch
              id="tagAudioEvents"
              checked={tagAudioEvents}
              onCheckedChange={setTagAudioEvents}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={requestTranscription}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Requesting...
            </>
          ) : (
            'Request Transcription'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 