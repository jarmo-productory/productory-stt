'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, Volume2, VolumeX, AlertCircle, Download, FileAudio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { formatDuration } from '@/lib/utils';

export interface AudioPlayerProps {
  audioUrl: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  initialVolume?: number;
  initialMuted?: boolean;
  lazyLoad?: boolean;
}

export interface AudioPlayerHandle {
  seekTo: (time: number) => void;
  play: () => Promise<void>;
  pause: () => void;
  getAudioElement: () => HTMLAudioElement | null;
}

// Helper function to check if a format is supported
const isFormatSupported = (url: string): boolean => {
  const audio = document.createElement('audio');
  
  // Extract file extension from URL, ignoring query parameters
  const urlWithoutParams = url.split('?')[0];
  const extension = urlWithoutParams.split('.').pop()?.toLowerCase();
  
  console.log('Extracted file extension:', extension);
  
  // Map extension to MIME type
  let mimeType = '';
  switch (extension) {
    case 'mp3':
      mimeType = 'audio/mpeg';
      break;
    case 'wav':
      mimeType = 'audio/wav';
      break;
    case 'ogg':
      mimeType = 'audio/ogg';
      break;
    case 'm4a':
      mimeType = 'audio/mp4';
      break;
    case 'flac':
      mimeType = 'audio/flac';
      break;
    default:
      console.warn('Unsupported file extension:', extension);
      return false;
  }
  
  const isSupported = audio.canPlayType(mimeType) !== '';
  console.log(`MIME type ${mimeType} supported: ${isSupported}`);
  return isSupported;
};

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  ({
    audioUrl,
    className = '',
    onTimeUpdate,
    onPlay,
    onPause,
    onEnded,
    initialVolume = 0.7,
    initialMuted = false,
    lazyLoad = false,
  }, ref) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(initialVolume);
    const [isMuted, setIsMuted] = useState(initialMuted);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(!lazyLoad);
    const [formatSupported, setFormatSupported] = useState(true);
    const [isAudioInitialized, setIsAudioInitialized] = useState(!lazyLoad);

    // Check if format is supported
    useEffect(() => {
      if (!audioUrl) return;
      
      const supported = isFormatSupported(audioUrl);
      console.log(`Audio format supported: ${supported}`);
      setFormatSupported(supported);
      
      if (!supported) {
        setError('This audio format is not supported by your browser. Try downloading the file instead.');
        setIsLoading(false);
      }
    }, [audioUrl]);

    // Expose methods to parent components via ref
    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      },
      play: async () => {
        if (!audioRef.current) return Promise.reject(new Error('Audio element not initialized'));
        if (!formatSupported) return Promise.reject(new Error('Audio format not supported'));
        
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          onPlay?.();
          return Promise.resolve();
        } catch (err) {
          console.error('Error playing audio:', err);
          setError('Failed to play audio');
          return Promise.reject(err);
        }
      },
      pause: () => {
        if (!audioRef.current) return;
        audioRef.current.pause();
        setIsPlaying(false);
        onPause?.();
      },
      getAudioElement: () => audioRef.current
    }));

    // Initialize audio player
    useEffect(() => {
      if (lazyLoad && !isAudioInitialized) {
        setIsLoading(false);
        return;
      }
      
      if (!audioUrl) {
        setError('No audio URL provided');
        setIsLoading(false);
        return;
      }
      
      if (!formatSupported) {
        return; // Don't initialize if format is not supported
      }
      
      console.log('Initializing audio player with URL:', audioUrl);
      setIsLoading(true);
      setError(null);
      
      const audio = new Audio();
      
      // Set up event listeners before setting the source
      audio.addEventListener('loadedmetadata', () => {
        console.log('Audio metadata loaded, duration:', audio.duration);
        setDuration(audio.duration);
        setIsLoading(false);
      });
      
      audio.addEventListener('timeupdate', () => {
        const newTime = audio.currentTime;
        setCurrentTime(newTime);
        onTimeUpdate?.(newTime);
      });
      
      audio.addEventListener('ended', () => {
        console.log('Audio playback ended');
        setIsPlaying(false);
        onEnded?.();
      });

      audio.addEventListener('error', (e) => {
        const errorDetails = audio.error ? 
          `Code: ${audio.error.code}, Message: ${audio.error.message}` : 
          'Unknown error';
        
        console.error('Audio playback error:', e);
        console.error('Audio error details:', errorDetails);
        
        let errorMessage = 'Failed to load audio file';
        
        if (audio.error) {
          switch (audio.error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              errorMessage = 'Audio playback was aborted';
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              errorMessage = 'Network error while loading audio';
              break;
            case MediaError.MEDIA_ERR_DECODE:
              errorMessage = 'Audio decoding error - format may not be supported';
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage = 'Audio format not supported by your browser';
              setFormatSupported(false);
              break;
          }
        }
        
        setError(errorMessage);
        setIsLoading(false);
      });
      
      audio.addEventListener('canplaythrough', () => {
        console.log('Audio can play through without buffering');
        setIsLoading(false);
      });
      
      // Set volume before loading the source
      audio.volume = isMuted ? 0 : volume;
      
      // Set crossOrigin to handle potential CORS issues
      audio.crossOrigin = 'anonymous';
      
      // Set the source last
      audio.src = audioUrl;
      audio.load();
      
      audioRef.current = audio;
      
      return () => {
        console.log('Cleaning up audio player');
        audio.pause();
        
        // Remove event listeners before clearing the source
        audio.removeEventListener('loadedmetadata', () => {});
        audio.removeEventListener('timeupdate', () => {});
        audio.removeEventListener('ended', () => {});
        audio.removeEventListener('error', () => {});
        audio.removeEventListener('canplaythrough', () => {});
        
        // Clear the source last
        audio.src = '';
      };
    }, [audioUrl, onTimeUpdate, onEnded, formatSupported, lazyLoad, isAudioInitialized]);

    // Update volume when it changes
    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.volume = isMuted ? 0 : volume;
      }
    }, [volume, isMuted]);
    
    // Handle play/pause
    const togglePlayPause = () => {
      if (!audioRef.current || !formatSupported) return;
      
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        onPause?.();
      } else {
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            onPlay?.();
          })
          .catch(err => {
            console.error('Error playing audio:', err);
            setError('Failed to play audio');
          });
      }
    };
    
    // Handle seek
    const handleSeek = (value: number[]) => {
      if (!audioRef.current) return;
      
      const newTime = value[0];
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    };
    
    // Handle volume change
    const handleVolumeChange = (value: number[]) => {
      if (!audioRef.current) return;
      
      const newVolume = value[0];
      audioRef.current.volume = newVolume;
      setVolume(newVolume);
      
      if (newVolume === 0) {
        setIsMuted(true);
      } else if (isMuted) {
        setIsMuted(false);
      }
    };
    
    // Toggle mute
    const toggleMute = () => {
      if (!audioRef.current) return;
      
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    };
    
    // Retry loading the audio
    const retryLoading = () => {
      if (!audioRef.current || !audioUrl) return;
      
      setError(null);
      setIsLoading(true);
      
      audioRef.current.load();
    };
    
    // Download the audio file
    const downloadAudio = () => {
      if (!audioUrl) return;
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = audioUrl;
      
      // Extract filename from URL
      const filename = audioUrl.split('/').pop() || 'audio';
      link.download = filename;
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    
    // Function to initialize audio (for lazy loading)
    const initializeAudio = () => {
      setIsAudioInitialized(true);
    };
    
    if (error) {
      return (
        <div className={`p-4 border border-red-200 rounded-md bg-red-50 ${className}`}>
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-medium">Audio playback error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
              <p className="text-red-600 text-xs mt-2">URL: {audioUrl}</p>
              <div className="flex gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={retryLoading}
                >
                  Retry
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  onClick={downloadAudio}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    if (isLoading) {
      return (
        <div className={`p-4 border rounded-md bg-muted/20 ${className}`}>
          <div className="flex items-center justify-center h-12">
            <div className="animate-pulse text-muted-foreground">Loading audio...</div>
          </div>
        </div>
      );
    }
    
    // If lazy loading is enabled and audio hasn't been initialized yet, show a button to load audio
    if (lazyLoad && !isAudioInitialized) {
      return (
        <div className={`rounded-md border border-input bg-background p-4 ${className}`}>
          <div className="flex flex-col items-center justify-center gap-4">
            <p className="text-sm text-muted-foreground">Audio preview available</p>
            <Button 
              onClick={initializeAudio}
              className="flex items-center gap-2"
            >
              <FileAudio className="h-4 w-4" />
              Load Audio Player
            </Button>
          </div>
        </div>
      );
    }
    
    // If format is not supported, show a message with download option
    if (!formatSupported) {
      return (
        <div className={`rounded-md border border-input bg-background p-4 ${className}`}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">
                This audio format is not supported by your browser. You can download the file instead.
              </p>
            </div>
            <div className="flex justify-between">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={retryLoading}
                className="flex items-center gap-2"
              >
                Try Again
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={downloadAudio}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Audio
              </Button>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className={`space-y-2 p-4 border rounded-md bg-muted/20 ${className}`}>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            disabled={!formatSupported}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          
          <div className="flex-1 mx-2">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              aria-label="Seek"
              disabled={!formatSupported}
            />
          </div>
          
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </div>
          
          <Button 
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            disabled={!formatSupported}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          
          <div className="w-20">
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              aria-label="Volume"
              disabled={!formatSupported}
            />
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={downloadAudio}
            aria-label="Download audio"
            title="Download audio"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }
);

// Add display name to the component
AudioPlayer.displayName = 'AudioPlayer';