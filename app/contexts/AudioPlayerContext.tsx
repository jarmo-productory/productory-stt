'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

interface AudioPlayerContextType {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  activeSegmentId: string | null;
  setAudioUrl: (url: string) => void;
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  setActiveSegment: (segmentId: string | null) => void;
}

// Create context with default values
const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  // State for audio player
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  
  // Audio element reference
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    
    // Event listeners
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, []);
  
  // Update audio source when URL changes
  useEffect(() => {
    console.log('AudioPlayerContext audioUrl changed:', audioUrl);
    if (!audioRef.current || !audioUrl) return;
    
    audioRef.current.src = audioUrl;
    audioRef.current.load();
    console.log('AudioPlayerContext loaded audio source:', audioUrl);
  }, [audioUrl]);
  
  // Update playback rate
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);
  
  // Play/pause controls
  const play = () => {
    if (!audioRef.current) return;
    audioRef.current.play().catch(error => {
      console.error('Error playing audio:', error);
    });
    setIsPlaying(true);
  };
  
  const pause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  };
  
  // Seek to specific time
  const seekTo = (time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };
  
  // Set active segment
  const setActiveSegment = (segmentId: string | null) => {
    setActiveSegmentId(segmentId);
  };
  
  // Context value
  const value = {
    audioUrl,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    activeSegmentId,
    setAudioUrl,
    play,
    pause,
    seekTo,
    setPlaybackRate,
    setActiveSegment,
  };
  
  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

// Custom hook for using the audio player context
export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
} 