'use client';

import { useEffect, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Volume1, VolumeX, Keyboard } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext';

interface AudioPlayerProps {
  transcriptionStatus?: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function AudioPlayer({ transcriptionStatus = 'none' }: AudioPlayerProps) {
  const {
    audioUrl,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    play,
    pause,
    seekTo,
    setPlaybackRate,
  } = useAudioPlayer();
  
  // Debug log to check if audioUrl is being received
  console.log('AudioPlayer received audioUrl:', audioUrl);
  
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [formatWarning, setFormatWarning] = useState<string | null>(null);
  
  // Check if the audio format is supported
  useEffect(() => {
    if (!audioUrl) return;
    
    console.log('AudioPlayer checking format for URL:', audioUrl);
    
    const audio = document.createElement('audio');
    
    // Extract the file format from the URL
    // First try to get it from the path
    let format = audioUrl.split('.').pop()?.toLowerCase();
    
    // If the format contains query parameters, remove them
    if (format && format.includes('?')) {
      format = format.split('?')[0];
    }
    
    // If we couldn't extract a valid format, use a generic message
    if (!format || format.length > 5 || !['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(format)) {
      format = 'The audio';
    }
    
    let isSupported = false;
    
    if (format === 'mp3' && audio.canPlayType('audio/mpeg')) {
      isSupported = true;
    } else if (format === 'wav' && audio.canPlayType('audio/wav')) {
      isSupported = true;
    } else if (format === 'ogg' && audio.canPlayType('audio/ogg')) {
      isSupported = true;
    } else if (format === 'm4a' && audio.canPlayType('audio/mp4')) {
      isSupported = true;
    } else if (format === 'flac' && audio.canPlayType('audio/flac')) {
      isSupported = true;
    }
    
    if (!isSupported) {
      if (format === 'The audio') {
        setFormatWarning(`Warning: This audio format may not be supported in your browser.`);
      } else {
        setFormatWarning(`Warning: ${format.toUpperCase()} format may not be supported in your browser.`);
      }
    } else {
      setFormatWarning(null);
    }
  }, [audioUrl]);
  
  // Handle play/pause
  const togglePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };
  
  // Skip backward 10 seconds
  const skipBackward = () => {
    seekTo(Math.max(0, currentTime - 10));
  };
  
  // Skip forward 10 seconds
  const skipForward = () => {
    seekTo(Math.min(duration, currentTime + 10));
  };
  
  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    
    // Update audio element volume
    const audioElement = document.querySelector('audio');
    if (audioElement) {
      audioElement.volume = newVolume;
    }
    
    // Update muted state
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };
  
  // Toggle mute
  const toggleMute = () => {
    const audioElement = document.querySelector('audio');
    if (audioElement) {
      if (isMuted) {
        audioElement.volume = volume;
        setIsMuted(false);
      } else {
        audioElement.volume = 0;
        setIsMuted(true);
      }
    }
  };
  
  // Handle playback rate change
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle shortcuts if we have an audio URL
    if (!audioUrl) return;
    
    // Don't trigger shortcuts when typing in input fields
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }
    
    switch (event.key) {
      case ' ': // Space bar
        event.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowLeft': // Left arrow
        event.preventDefault();
        skipBackward();
        break;
      case 'ArrowRight': // Right arrow
        event.preventDefault();
        skipForward();
        break;
      case 'm': // Mute/unmute
        event.preventDefault();
        toggleMute();
        break;
      case '1': // Playback rate 1x
        event.preventDefault();
        setPlaybackRate(1);
        break;
      case '2': // Playback rate 1.5x
        event.preventDefault();
        setPlaybackRate(1.5);
        break;
      case '3': // Playback rate 2x
        event.preventDefault();
        setPlaybackRate(2);
        break;
      default:
        break;
    }
  }, [audioUrl, togglePlayPause, skipBackward, skipForward, toggleMute, setPlaybackRate]);
  
  // Add keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
  
  // Add keyboard shortcuts tooltip
  const keyboardShortcuts = [
    { key: 'Space', action: 'Play/Pause' },
    { key: '←', action: 'Skip backward 10s' },
    { key: '→', action: 'Skip forward 10s' },
    { key: 'M', action: 'Mute/Unmute' },
    { key: '1', action: 'Normal speed (1x)' },
    { key: '2', action: 'Speed 1.5x' },
    { key: '3', action: 'Speed 2x' },
  ];
  
  // If no audio URL, render a placeholder
  if (!audioUrl) {
    console.log('AudioPlayer rendering placeholder - no audioUrl available');
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
        <div className="max-w-screen-xl mx-auto flex flex-col">
          <div className="text-center text-gray-500">
            <p>No audio file available.</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
      <div className="max-w-screen-xl mx-auto flex flex-col">
        {/* Transcription status message */}
        {transcriptionStatus && transcriptionStatus !== 'completed' && (
          <div className="mb-2 text-xs text-blue-600 bg-blue-50 p-2 rounded text-center">
            {transcriptionStatus === 'none' && "Transcription not requested yet"}
            {transcriptionStatus === 'pending' && "Transcription is queued"}
            {transcriptionStatus === 'processing' && "Transcription is being processed"}
            {transcriptionStatus === 'failed' && "Transcription failed - please try requesting it again"}
          </div>
        )}
        
        {/* Format warning */}
        {formatWarning && (
          <div className="mb-2 text-xs text-amber-600 bg-amber-50 p-1 rounded">
            {formatWarning}
          </div>
        )}
        
        {/* Progress bar */}
        <div className="w-full mb-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={(value) => seekTo(value[0])}
            className="w-full"
            aria-label="Audio progress"
            aria-valuemin={0}
            aria-valuemax={duration || 100}
            aria-valuenow={currentTime}
            aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            {/* Playback controls */}
            <Button
              variant="ghost"
              size="sm"
              onClick={skipBackward}
              className="h-8 w-8 p-0"
              aria-label="Skip backward 10 seconds"
              title="Skip backward 10 seconds"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={togglePlayPause}
              className="h-8 w-8 p-0 rounded-full"
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={skipForward}
              className="h-8 w-8 p-0"
              aria-label="Skip forward 10 seconds"
              title="Skip forward 10 seconds"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            
            {/* Keyboard shortcuts tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 ml-2"
                    aria-label="Keyboard shortcuts"
                  >
                    <Keyboard className="h-4 w-4 text-gray-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="p-2">
                  <div className="text-xs">
                    <h4 className="font-semibold mb-1">Keyboard Shortcuts</h4>
                    <ul className="space-y-1">
                      {keyboardShortcuts.map((shortcut, index) => (
                        <li key={index} className="flex items-center">
                          <span className="inline-block bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 font-mono mr-2">
                            {shortcut.key}
                          </span>
                          <span>{shortcut.action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Volume control - hide on small screens */}
          <div className="hidden sm:flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              className="h-8 w-8 p-0"
              aria-label={isMuted ? "Unmute" : "Mute"}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : volume < 0.5 ? (
                <Volume1 className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            
            <Slider
              value={[isMuted ? 0 : volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-24"
              aria-label="Volume"
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={isMuted ? 0 : volume}
              aria-valuetext={`Volume ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            />
          </div>
          
          {/* Playback rate */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Speed:</span>
            <select
              value={playbackRate}
              onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
              className="text-xs bg-transparent border border-gray-200 rounded p-1"
              aria-label="Playback speed"
              title="Playback speed"
            >
              {PLAYBACK_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
} 