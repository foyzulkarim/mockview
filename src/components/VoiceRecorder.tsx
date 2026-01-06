'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  sessionUuid: string;
  questionId?: number;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'transcribing';

export function VoiceRecorder({
  onTranscription,
  sessionUuid,
  questionId,
  disabled = false,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // Update audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current && state === 'recording') {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average level
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(Math.min(100, average));

      animationRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [state]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      // Set up audio analysis for visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Clean up audio context
        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Process recording
        if (chunksRef.current.length > 0) {
          await processRecording();
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setState('recording');
      setDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Start audio level visualization
      updateAudioLevel();
    } catch (err) {
      console.error('Failed to start recording:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        setError('Failed to start recording. Please check your microphone.');
      }
    }
  }, [updateAudioLevel]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setAudioLevel(0);
  }, []);

  // Process and transcribe recording
  const processRecording = useCallback(async () => {
    setState('transcribing');

    try {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

      // Create form data
      const formData = new FormData();
      formData.append('sessionUuid', sessionUuid);
      formData.append('audio', audioBlob, 'recording.webm');
      if (questionId) {
        formData.append('questionId', questionId.toString());
      }

      // Send to transcription API
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Transcription failed');
      }

      onTranscription(data.data.text);
      setState('idle');
    } catch (err) {
      console.error('Transcription failed:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed');
      setState('idle');
    }
  }, [sessionUuid, questionId, onTranscription]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle click based on state
  const handleClick = useCallback(() => {
    if (disabled) return;

    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  }, [state, disabled, startRecording, stopRecording]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Recording button */}
      <button
        onClick={handleClick}
        disabled={disabled || state === 'transcribing'}
        className={`
          relative w-20 h-20 rounded-full transition-all duration-200
          flex items-center justify-center
          ${disabled || state === 'transcribing'
            ? 'bg-gray-700 cursor-not-allowed'
            : state === 'recording'
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-blue-600 hover:bg-blue-700'
          }
        `}
        aria-label={state === 'recording' ? 'Stop recording' : 'Start recording'}
      >
        {state === 'transcribing' ? (
          <div className="animate-spin w-8 h-8 border-3 border-white border-t-transparent rounded-full" />
        ) : state === 'recording' ? (
          <div className="w-6 h-6 bg-white rounded-sm" />
        ) : (
          <svg
            className="w-8 h-8 text-white"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}

        {/* Audio level indicator ring */}
        {state === 'recording' && (
          <div
            className="absolute inset-0 rounded-full border-4 border-red-300 opacity-50"
            style={{
              transform: `scale(${1 + audioLevel / 200})`,
              transition: 'transform 0.1s ease-out',
            }}
          />
        )}
      </button>

      {/* Status text */}
      <div className="text-center">
        {state === 'idle' && (
          <p className="text-sm text-gray-400">
            {disabled ? 'Recording disabled' : 'Click to record your answer'}
          </p>
        )}
        {state === 'recording' && (
          <div className="space-y-1">
            <p className="text-sm text-red-400 font-medium">Recording...</p>
            <p className="text-lg font-mono text-white">{formatDuration(duration)}</p>
            <p className="text-xs text-gray-500">Click to stop</p>
          </div>
        )}
        {state === 'transcribing' && (
          <p className="text-sm text-blue-400">Transcribing your answer...</p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-400 text-center max-w-xs">{error}</p>
      )}
    </div>
  );
}
