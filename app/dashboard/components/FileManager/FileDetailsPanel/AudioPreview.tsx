'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, Download, RotateCcw, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Extend Window interface to include our audioObjectUrls property
declare global {
  interface Window {
    audioObjectUrls?: Map<string, string>;
    // Store audio state between tab switches
    audioState?: {
      fileId: string;
      isPlaying: boolean;
      currentTime: number;
      volume: number;
      isMuted: boolean;
      playbackRate: number;
    };
  }
}

// Define the FileObject interface (should match the one in FileManager)
interface FileObject {
  id: string;
  name: string;         // Display name (original filename)
  storage_name?: string; // Name in storage (formatted filename)
  size: number;
  created_at: string;
  duration?: number; // Audio duration in seconds
  status?: 'ready' | 'processing' | 'error' | 'transcribed'; // File processing status
  metadata?: {
    [key: string]: any;
  };
}

// Define the audio metadata interface
interface AudioMetadata {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  duration: number | null;
  size: number | null;
  format: string | null;
  created_at: string | null;
  updated_at: string | null;
  status: string | null;
  metadata: any;
}

interface AudioPreviewProps {
  file: FileObject;
}

// Media error codes for better error messages
const mediaErrorMessages = {
  1: "Fetching process aborted by user",
  2: "Network error occurred while downloading",
  3: "Error occurred while decoding the audio",
  4: "Audio format not supported by your browser"
};

export default function AudioPreview({ file }: AudioPreviewProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isTabActive, setIsTabActive] = useState(true);
  
  // New state for audio metadata
  const [audioMetadata, setAudioMetadata] = useState<AudioMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const getFileExtension = (filename: string = ''): string => 
    filename.split('.').pop()?.toLowerCase() || '';
  
  const getMimeType = (extension: string): string => {
    switch (extension) {
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'ogg': return 'audio/ogg';
      case 'm4a': return 'audio/mp4';
      case 'flac': return 'audio/flac';
      default: return '';
    }
  };
  
  const isFormatSupported = (filename: string): boolean => {
    const extension = getFileExtension(filename);
    const mimeType = getMimeType(extension);
    const audio = document.createElement('audio');
    return audio.canPlayType(mimeType) !== '';
  };
  
  // Fetch file with progress tracking
  const fetchWithProgress = async (url: string, signal: AbortSignal): Promise<Blob> => {
    const response = await fetch(url, { signal });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    // Get total file size for progress calculation
    const totalBytes = Number(response.headers.get('Content-Length')) || 0;
    let loadedBytes = 0;
    
    // Create a ReadableStream to track download progress
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    
    // Create a new ReadableStream and enqueue chunks as they arrive
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              controller.close();
              break;
            }
            
            loadedBytes += value.length;
            
            // Calculate and update progress percentage
            if (totalBytes > 0) {
              const percentage = Math.round((loadedBytes / totalBytes) * 100);
              setLoadingProgress(percentage);
            }
            
            // Enqueue the chunk for the new response
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
        }
      }
    });
    
    // Create a new Response from the stream
    const newResponse = new Response(stream, {
      headers: response.headers
    });
    
    return await newResponse.blob();
  };
  
  // Get a direct URL for the audio file
  const getDownloadUrl = async (fileName: string): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    try {
      console.log(`Getting audio URL for: ${fileName}`);
      setLoadingProgress(0);
      
      // Path format in storage is audio/{userId}/{fileName}
      const filePath = `audio/${user.id}/${fileName}`;
      
      // Try direct download approach first
      try {
        if (abortControllerRef.current) {
          // Get the signed URL to use with our progress-tracking fetch
          const { data: signedData, error: signedError } = await supabase
            .storage
            .from('audio-files')
            .createSignedUrl(filePath, 60);
            
          if (signedError || !signedData?.signedUrl) {
            throw new Error('Could not generate signed URL');
          }
            
          // Fetch with progress tracking
          const blob = await fetchWithProgress(
            signedData.signedUrl, 
            abortControllerRef.current.signal
          );
            
          // Create an object URL from the blob
          const url = URL.createObjectURL(
            new Blob([blob], { type: getMimeType(getFileExtension(fileName)) || 'audio/mp4' })
          );
            
          // Store for cleanup
          window.audioObjectUrls = window.audioObjectUrls || new Map();
          window.audioObjectUrls.set(file.id, url);
            
          return url;
        }
      } catch (fetchError) {
        console.warn('Progress-tracking fetch failed:', fetchError);
      }
      
      // Fallback: Standard Supabase download
      const { data, error } = await supabase
        .storage
        .from('audio-files')
        .download(filePath);
      
      if (error) {
        console.error('Download method failed:', error);
        
        // Last resort: Try simple signed URL
        const { data: signedData, error: signedError } = await supabase
          .storage
          .from('audio-files')
          .createSignedUrl(filePath, 60, {
            download: fileName,
          });
        
        if (signedError) {
          console.error('Signed URL method failed:', signedError);
          throw new Error(`Could not access audio file: ${signedError.message}`);
        }
        
        if (!signedData?.signedUrl) {
          throw new Error('No signed URL returned from Supabase');
        }
        
        console.log('Using signed URL as fallback');
        return signedData.signedUrl;
      }
      
      // If download succeeded, create an Object URL from the blob
      const url = URL.createObjectURL(data);
      console.log('Created object URL from downloaded blob');
      
      // Store the blob URL for cleanup
      window.audioObjectUrls = window.audioObjectUrls || new Map();
      window.audioObjectUrls.set(file.id, url);
      
      // Set progress to 100% since we've completed the download
      setLoadingProgress(100);
      
      return url;
    } catch (err) {
      console.error('Error in getDownloadUrl:', err);
      throw err;
    }
  };
  
  // Save audio state before tab is hidden
  const saveAudioState = () => {
    if (!audioRef.current) return;
    
    window.audioState = {
      fileId: file.id,
      isPlaying,
      currentTime: audioRef.current.currentTime,
      volume,
      isMuted,
      playbackRate
    };
    
    console.log('Audio state saved:', window.audioState);
  };
  
  // Restore audio state when tab becomes visible again
  const restoreAudioState = () => {
    if (!audioRef.current || !window.audioState || window.audioState.fileId !== file.id) {
      return;
    }
    
    console.log('Restoring audio state:', window.audioState);
    
    // Restore position
    audioRef.current.currentTime = window.audioState.currentTime;
    setCurrentTime(window.audioState.currentTime);
    
    // Restore playback rate
    setPlaybackRate(window.audioState.playbackRate);
    audioRef.current.playbackRate = window.audioState.playbackRate;
    
    // Restore volume
    setVolume(window.audioState.volume);
    setIsMuted(window.audioState.isMuted);
    audioRef.current.volume = window.audioState.isMuted ? 0 : window.audioState.volume;
    
    // Resume playback if it was playing
    if (window.audioState.isPlaying && audioRef.current.paused) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Error resuming playback:', err);
          setIsPlaying(false);
        });
    }
  };
  
  // Handle visibility change events
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setIsTabActive(isVisible);
      
      if (!isVisible) {
        saveAudioState();
        
        // Pause audio when tab becomes invisible
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          // Don't update isPlaying state here to remember it was playing
        }
      } else {
        // Tab is visible again - check if audio element is still valid
        if (audioRef.current && (!audioRef.current.src || audioRef.current.src === '')) {
          console.log('Audio source lost during tab switch, reloading');
          // If we have a cached object URL, restore it
          if (window.audioObjectUrls?.has(file.id)) {
            const objectUrl = window.audioObjectUrls.get(file.id);
            if (objectUrl) {
              console.log('Restoring cached object URL');
              audioRef.current.src = objectUrl;
              audioRef.current.load();
              
              // After loading metadata, restore state
              const handleReloaded = () => {
                restoreAudioState();
                audioRef.current?.removeEventListener('loadedmetadata', handleReloaded);
              };
              
              audioRef.current.addEventListener('loadedmetadata', handleReloaded);
            }
          } else if (downloadUrl) {
            // If we have a downloadUrl but no cached object URL
            console.log('Restoring from downloadUrl');
            audioRef.current.src = downloadUrl;
            audioRef.current.load();
            
            // After loading metadata, restore state
            const handleReloaded = () => {
              restoreAudioState();
              audioRef.current?.removeEventListener('loadedmetadata', handleReloaded);
            };
            
            audioRef.current.addEventListener('loadedmetadata', handleReloaded);
          } else {
            // Last resort - reload the audio completely
            console.log('No cached audio source found, reloading from scratch');
            reloadAudio();
          }
        } else {
          // Audio element is still valid, just restore state
          restoreAudioState();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [file.id, isPlaying, volume, isMuted, playbackRate, downloadUrl]);
  
  // Function to fetch audio metadata from database
  const fetchAudioMetadata = async () => {
    if (!user || !file) return;
    
    try {
      setMetadataLoading(true);
      
      // Calculate file path format using storage_name if available
      const fileName = file.storage_name || file.name;
      const filePath = `audio/${user.id}/${fileName}`;
      
      console.log('Fetching audio metadata for file path:', filePath);
      
      // Query the audio_files table
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('file_path', filePath)
        .single();
      
      if (error) {
        console.error('Error fetching audio metadata:', error);
        return;
      }
      
      if (data) {
        console.log('Retrieved audio metadata:', data);
        setAudioMetadata(data);
        
        // If duration exists in metadata, use it
        if (data.duration && !isNaN(Number(data.duration))) {
          console.log('Using stored duration from database:', data.duration);
          setDuration(Number(data.duration));
        }
      }
    } catch (err) {
      console.error('Failed to fetch audio metadata:', err);
    } finally {
      setMetadataLoading(false);
    }
  };
  
  // Fetch file and create a download URL
  useEffect(() => {
    if (!user || !file?.name) return;
    
    // Create an abort controller for the fetch
    abortControllerRef.current = new AbortController();
    
    setError(null);
    setIsLoading(true);
    
    // Reset progress bar
    setLoadingProgress(0);
    
    // Get any existing duration from metadata if available
    fetchAudioMetadata();
    
    // Use storage_name if available, otherwise fall back to name
    const fileName = file.storage_name || file.name;
    console.log(`Fetching audio file: ${fileName} (display name: ${file.name})`);
    
    getDownloadUrl(fileName)
      .then((url) => {
        console.log(`Got download URL: ${url.substring(0, 50)}...`);
        setDownloadUrl(url);
        setIsLoading(false);
        
        // Play automatically if we were playing before
        if (window.audioState?.fileId === file.id && window.audioState?.isPlaying) {
          // Wait a little before playing to ensure audio is loaded
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.currentTime = window.audioState?.currentTime || 0;
              audioRef.current.play().catch(err => {
                console.warn('Failed to autoplay:', err);
              });
            }
          }, 500);
        }
      })
      .catch((err) => {
        console.error('Error getting download URL:', err);
        setIsLoading(false);
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (
          (err instanceof Error && 
           (errorMessage.includes('decode') || errorMessage.includes('EncodingError')))
        ) {
          console.warn('Error loading audio (codec/format issue):', err);
          setError('This audio file uses a format or codec not supported by your browser. Try downloading the file instead.');
        } else {
          console.error('Error loading audio:', err);
          setError('Failed to load audio file. Please try again.');
        }
      });
      
    return () => {
      // Cancel any in-flight fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Clean up object URL if we created one
      if (window.audioObjectUrls?.has(file.id)) {
        const objectUrl = window.audioObjectUrls.get(file.id);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
        window.audioObjectUrls.delete(file.id);
      }
    };
  }, [file, user]);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleLoadedMetadata = () => {
      console.log('Audio metadata loaded, duration:', audio.duration);
      setDuration(audio.duration);
      setIsLoading(false);
    };
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    
    const handleError = (e: Event) => {
      const audioEl = e.target as HTMLAudioElement;
      let errorMessage = 'Unknown playback error';
      
      if (audioEl.error) {
        const errorCode = audioEl.error.code;
        
        if (audioEl.error.message?.includes('decode') || audioEl.error.message?.includes('EncodingError')) {
          console.warn(`Audio decode error (code ${errorCode}) - file may use an unsupported codec:`, audioEl.error.message);
          
          // Show a more helpful message to the user
          setError('This audio file uses a format or codec not supported by your browser. Try downloading the file instead.');
        } else {
          console.error(`Audio error (code ${errorCode}):`, audioEl.error.message);
        }
      }
      
      // Don't set error if tab is inactive - we'll handle this when tab becomes active again
      if (isTabActive) {
        setError(errorMessage);
        setIsLoading(false);
      }
    };
    
    audio.volume = isMuted ? 0 : volume;
    audio.playbackRate = playbackRate;
    
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [file.name, volume, isMuted, playbackRate, isTabActive]);
  
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Play error:', err);
          setError(`Playback failed: ${err.message}`);
        });
    }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };
  
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
  
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };
  
  const reloadAudio = () => {
    setIsLoading(true);
    setError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.load();
    }
    
    // Reload from scratch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    const loadAudio = async () => {
      if (!file?.name) {
        setError('Invalid file data');
        setIsLoading(false);
        return;
      }
      
      try {
        const fileName = file.storage_name || file.name;
        const url = await getDownloadUrl(fileName);
        setDownloadUrl(url);
        
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.crossOrigin = "anonymous";
          audioRef.current.load();
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (
          (err instanceof Error && 
           (errorMessage.includes('decode') || errorMessage.includes('EncodingError')))
        ) {
          console.warn('Error loading audio (codec/format issue):', err);
          setError('This audio file uses a format or codec not supported by your browser. Try downloading the file instead.');
        } else {
          console.error('Error loading audio:', err);
          setError('Failed to load audio file. Please try again.');
        }
        setIsLoading(false);
      }
    };
    
    loadAudio();
  };
  
  const downloadAudio = () => {
    if (!downloadUrl) return;
    
    // For Object URLs, we need to download the actual file
    if (downloadUrl.startsWith('blob:')) {
      // Download directly from Supabase
      if (user) {
        const filePath = `audio/${user.id}/${file.name}`;
        supabase.storage.from('audio-files').download(filePath)
          .then(({ data, error }) => {
            if (error) {
              console.error('Download error:', error);
              setError(`Download failed: ${error.message}`);
              return;
            }
            
            if (!data) {
              setError('Failed to download file');
              return;
            }
            
            // Create a download link
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          });
      }
    } else {
      // For direct URLs, use the standard approach
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="h-4 w-4" />;
    if (volume < 0.5) return <Volume1 className="h-4 w-4" />;
    return <Volume2 className="h-4 w-4" />;
  };
  
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
        Audio Preview
      </h3>
      
      <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-4">
        <audio 
          ref={audioRef}
          preload="metadata"
          crossOrigin="anonymous"
          className="hidden"
        />
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-24 space-y-4">
            <div className="animate-pulse flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
              <span className="text-sm text-gray-500">Loading audio...</span>
            </div>
            
            {/* Loading progress bar */}
            <div className="w-full max-w-sm">
              <div className="relative h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-150 ease-out" 
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-end mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">{loadingProgress}%</span>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 space-y-4 p-4">
            <div className="text-red-500 text-sm text-center max-w-md flex items-center gap-2 justify-center">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
            <button
              onClick={downloadAudio}
              className="flex items-center justify-center px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Audio Instead
            </button>
            <div className="text-xs text-amber-500 text-center max-w-md">
              Note: Your browser may not support direct playback of this audio format.
              The download option will allow you to play it with a local media player.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-4 flex-wrap">
              <button
                onClick={togglePlayPause}
                className={cn(
                  "flex items-center justify-center p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  isPlaying && "bg-blue-600"
                )}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>
              
              <div className="text-sm text-gray-600 dark:text-gray-300 min-w-[80px]">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1">/</span>
                <span>{formatTime(duration)}</span>
              </div>
              
              <div className="flex space-x-2">
                <button 
                  onClick={reloadAudio}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 p-1"
                  aria-label="Reload audio"
                  title="Reload audio"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                
                <button 
                  onClick={downloadAudio}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 p-1"
                  aria-label="Download audio"
                  title="Download audio"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
              
              <div className="flex items-center space-x-2 ml-auto">
                <button 
                  onClick={toggleMute}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 p-1"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {getVolumeIcon()}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-md appearance-none cursor-pointer accent-blue-500"
                  aria-label="Volume control"
                />
              </div>
            </div>
            
            <div className="w-full pt-1">
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.01"
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-md appearance-none cursor-pointer accent-blue-500"
                aria-label="Seek audio timeline"
                disabled={duration === 0}
              />
            </div>
            
            <div className="flex items-center justify-center space-x-2 pt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Speed:</span>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handlePlaybackRateChange(rate)}
                  className={cn(
                    "text-xs px-2 py-1 rounded-md",
                    playbackRate === rate
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  )}
                  title={`${rate}x playback speed`}
                >
                  {rate}x
                </button>
              ))}
            </div>
            
            <div className="text-xs text-gray-500 dark:text-gray-400 pt-2">
              <p><span className="font-medium">Filename:</span> {file.name}</p>
              <p><span className="font-medium">Size:</span> {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              <p>
                <span className="font-medium">Format:</span> {getFileExtension(file.name).toUpperCase()}
                {!isFormatSupported(file.name) && 
                  <span className="text-yellow-500 ml-2">(Limited browser support)</span>
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 