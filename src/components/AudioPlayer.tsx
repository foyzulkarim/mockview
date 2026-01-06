'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface AudioPlayerProps {
  text: string;
  sessionUuid: string;
  autoPlay?: boolean;
  onPlayComplete?: () => void;
  disabled?: boolean;
}

type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export function AudioPlayer({
  text,
  sessionUuid,
  autoPlay = false,
  onPlayComplete,
  disabled = false,
}: AudioPlayerProps) {
  const [state, setState] = useState<PlayerState>('idle');
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Clean up audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  // Load and optionally auto-play
  useEffect(() => {
    if (autoPlay && text && state === 'idle') {
      loadAndPlay();
    }
  }, [autoPlay, text]);

  const loadAndPlay = useCallback(async () => {
    if (!text || disabled) return;

    setState('loading');
    setError(null);

    try {
      // Fetch synthesized audio
      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionUuid,
          text,
          stream: false,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Speech synthesis failed');
      }

      // Convert base64 to audio URL
      const audioData = atob(data.data.audio);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }

      const blob = new Blob([audioArray], { type: `audio/${data.data.format}` });

      // Clean up previous URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }

      audioUrlRef.current = URL.createObjectURL(blob);

      // Create and play audio
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      audioRef.current.src = audioUrlRef.current;

      audioRef.current.onended = () => {
        setState('idle');
        onPlayComplete?.();
      };

      audioRef.current.onerror = () => {
        setState('error');
        setError('Failed to play audio');
      };

      await audioRef.current.play();
      setState('playing');
    } catch (err) {
      console.error('Audio playback failed:', err);
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to synthesize speech');
    }
  }, [text, sessionUuid, disabled, onPlayComplete]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) {
      loadAndPlay();
      return;
    }

    if (state === 'playing') {
      audioRef.current.pause();
      setState('paused');
    } else if (state === 'paused') {
      audioRef.current.play();
      setState('playing');
    } else {
      loadAndPlay();
    }
  }, [state, loadAndPlay]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState('idle');
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        disabled={disabled || state === 'loading'}
        className={`
          p-2 rounded-full transition-colors
          ${disabled || state === 'loading'
            ? 'bg-gray-700 cursor-not-allowed'
            : 'bg-gray-700 hover:bg-gray-600'
          }
        `}
        aria-label={state === 'playing' ? 'Pause' : 'Play'}
      >
        {state === 'loading' ? (
          <div className="w-5 h-5 animate-spin border-2 border-blue-400 border-t-transparent rounded-full" />
        ) : state === 'playing' ? (
          <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Status indicator */}
      {state === 'playing' && (
        <div className="flex items-center gap-1">
          <span className="w-1 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-4 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      )}

      {/* Stop button (only when playing or paused) */}
      {(state === 'playing' || state === 'paused') && (
        <button
          onClick={stop}
          className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
          aria-label="Stop"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h12v12H6z" />
          </svg>
        </button>
      )}

      {/* Error message */}
      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}
