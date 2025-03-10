'use client';

import { useState, useMemo } from 'react';
import { Loader2, FileAudio, Check, X, Info, Users, Presentation, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobStatus } from '@/app/components/jobs/JobStatus';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { languages, getPopularLanguages, filterLanguages } from '@/app/data/languages';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export type TranscriptionRequestProps = {
  fileId: string;
  onTranscriptionCreated?: (transcriptionId: string) => void;
  className?: string;
};

// Define preset types
type PresetType = 'interview' | 'lecture' | 'meeting' | 'custom';

// Define preset configurations
interface PresetConfig {
  diarize: boolean;
  numSpeakers: number | null;
  timestampsGranularity: 'word' | 'character' | 'none';
  tagAudioEvents: boolean;
  icon: React.ReactNode;
  description: string;
}

export function TranscriptionRequest({
  fileId,
  onTranscriptionCreated,
  className,
}: TranscriptionRequestProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Transcription options
  const [language, setLanguage] = useState('en');
  const [diarize, setDiarize] = useState(true);
  const [numSpeakers, setNumSpeakers] = useState<number | null>(2);
  const [timestampsGranularity, setTimestampsGranularity] = useState<'word' | 'character' | 'none'>('word');
  const [tagAudioEvents, setTagAudioEvents] = useState(true);
  const [activePreset, setActivePreset] = useState<PresetType>('custom');
  
  // Define presets
  const presets: Record<PresetType, PresetConfig> = {
    interview: {
      diarize: true,
      numSpeakers: 2,
      timestampsGranularity: 'word',
      tagAudioEvents: true,
      icon: <Users className="h-4 w-4" />,
      description: 'Optimized for conversations between 2 people'
    },
    lecture: {
      diarize: false,
      numSpeakers: 1,
      timestampsGranularity: 'word',
      tagAudioEvents: true,
      icon: <Presentation className="h-4 w-4" />,
      description: 'Optimized for single speaker presentations'
    },
    meeting: {
      diarize: true,
      numSpeakers: 5,
      timestampsGranularity: 'word',
      tagAudioEvents: true,
      icon: <MessageSquare className="h-4 w-4" />,
      description: 'Optimized for multi-person discussions'
    },
    custom: {
      diarize: true,
      numSpeakers: null,
      timestampsGranularity: 'word',
      tagAudioEvents: true,
      icon: <FileAudio className="h-4 w-4" />,
      description: 'Custom settings'
    }
  };
  
  // Apply preset settings
  const applyPreset = (preset: PresetType) => {
    if (preset === 'custom') {
      setActivePreset('custom');
      return;
    }
    
    const config = presets[preset];
    setDiarize(config.diarize);
    setNumSpeakers(config.numSpeakers);
    setTimestampsGranularity(config.timestampsGranularity);
    setTagAudioEvents(config.tagAudioEvents);
    setActivePreset(preset);
  };
  
  // Prepare language options for the combobox
  const languageOptions = useMemo(() => {
    return languages.map(lang => ({
      value: lang.code,
      label: lang.name,
      extra: lang.native && lang.native !== lang.name ? lang.native : undefined
    }));
  }, []);
  
  // Group popular languages separately
  const groupedLanguageOptions = useMemo(() => {
    const popular = getPopularLanguages().map(lang => ({
      value: lang.code,
      label: lang.name,
      extra: lang.native && lang.native !== lang.name ? lang.native : undefined
    }));
    
    const other = languages
      .filter(lang => !lang.popular)
      .map(lang => ({
        value: lang.code,
        label: lang.name,
        extra: lang.native && lang.native !== lang.name ? lang.native : undefined
      }));
    
    return {
      'Popular Languages': popular,
      'All Languages': other
    };
  }, []);
  
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
  
  // Helper component for option labels with tooltips
  const LabelWithTooltip = ({ htmlFor, label, tooltip }: { htmlFor: string, label: string, tooltip: string }) => (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor} className="cursor-pointer">{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
  
  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg">
            <FileAudio className="h-5 w-5 mr-2" />
            Request Transcription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          
          {/* Presets */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <Label>Presets</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p>Choose a preset to automatically configure settings for common use cases.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(presets) as PresetType[]).map((preset) => (
                <Tooltip key={preset}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activePreset === preset ? "default" : "outline"}
                      className="flex flex-col items-center justify-center h-12 py-1 px-2"
                      onClick={() => applyPreset(preset)}
                    >
                      <div className="flex items-center gap-1">
                        {presets[preset].icon}
                        <span className="text-xs font-medium capitalize">{preset}</span>
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>{presets[preset].description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
          
          {/* Basic Options */}
          <div className="space-y-4">
            <div className="space-y-2">
              <LabelWithTooltip 
                htmlFor="language" 
                label="Language" 
                tooltip="Select the primary language spoken in the audio. If not selected, the system will attempt to auto-detect the language."
              />
              <Combobox
                options={languageOptions}
                groupedOptions={groupedLanguageOptions}
                value={language}
                onChange={setLanguage}
                placeholder="Select language"
                searchPlaceholder="Search languages..."
                emptyMessage="No language found."
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <LabelWithTooltip 
                  htmlFor="diarize" 
                  label="Identify different speakers" 
                  tooltip="Enables speaker identification in the transcription. The system will attempt to distinguish between different speakers and label them accordingly. This separates the transcription by speaker, making it easier to follow conversations."
                />
                <Switch
                  id="diarize"
                  checked={diarize}
                  onCheckedChange={(checked) => {
                    setDiarize(checked);
                    setActivePreset('custom');
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="border rounded-md">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-gray-50">
              <div className="flex items-center gap-1">
                <Label className="cursor-pointer">Advanced Options</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p>Configure additional transcription settings for more control.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 pt-0 space-y-4 border-t">
              {diarize && (
                <div className="space-y-2 pt-3">
                  <LabelWithTooltip 
                    htmlFor="numSpeakers" 
                    label="Number of Speakers" 
                    tooltip="Specify how many different speakers are in the audio. This helps the system more accurately identify and separate speakers. Choose 'Auto-detect' to let the system determine the optimal number of speakers (up to 32)."
                  />
                  <Select 
                    value={numSpeakers === null ? 'auto' : numSpeakers.toString()} 
                    onValueChange={(value) => {
                      setNumSpeakers(value === 'auto' ? null : parseInt(value, 10));
                      setActivePreset('custom');
                    }}
                  >
                    <SelectTrigger id="numSpeakers">
                      <SelectValue placeholder="Select number of speakers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
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
                <LabelWithTooltip 
                  htmlFor="timestampsGranularity" 
                  label="Add timestamps at" 
                  tooltip="Controls how detailed the timestamps are in the transcription. Word-level timestamps are more precise but can make the text more cluttered. Timestamps help you navigate to specific points in the audio."
                />
                <Select 
                  value={timestampsGranularity} 
                  onValueChange={(value) => {
                    setTimestampsGranularity(value as 'word' | 'character' | 'none');
                    setActivePreset('custom');
                  }}
                >
                  <SelectTrigger id="timestampsGranularity">
                    <SelectValue placeholder="Select timestamp level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="word">Each word</SelectItem>
                    <SelectItem value="character">Each character</SelectItem>
                    <SelectItem value="none">Don't add timestamps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <LabelWithTooltip 
                    htmlFor="tagAudioEvents" 
                    label="Detect non-speech sounds (applause, music, etc.)" 
                    tooltip="Identifies and labels non-speech audio events like music, applause, or background noises in the transcription. This adds context by identifying important sounds in the audio."
                  />
                  <Switch
                    id="tagAudioEvents"
                    checked={tagAudioEvents}
                    onCheckedChange={(checked) => {
                      setTagAudioEvents(checked);
                      setActivePreset('custom');
                    }}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
    </TooltipProvider>
  );
} 