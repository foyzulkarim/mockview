'use client';

import { useState, useEffect, useCallback } from 'react';

interface VoiceServicesState {
  sttAvailable: boolean;
  ttsAvailable: boolean;
  voiceEnabled: boolean;
  isChecking: boolean;
  error: string | null;
}

export function useVoiceServices() {
  const [state, setState] = useState<VoiceServicesState>({
    sttAvailable: false,
    ttsAvailable: false,
    voiceEnabled: false,
    isChecking: true,
    error: null,
  });

  const checkServices = useCallback(async () => {
    setState(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      const response = await fetch('/api/voice/health');
      const data = await response.json();

      if (data.success) {
        setState({
          sttAvailable: data.data.stt.available,
          ttsAvailable: data.data.tts.available,
          voiceEnabled: data.data.voiceEnabled,
          isChecking: false,
          error: null,
        });
      } else {
        throw new Error(data.error?.message || 'Failed to check voice services');
      }
    } catch (err) {
      setState({
        sttAvailable: false,
        ttsAvailable: false,
        voiceEnabled: false,
        isChecking: false,
        error: err instanceof Error ? err.message : 'Failed to check voice services',
      });
    }
  }, []);

  // Check services on mount
  useEffect(() => {
    checkServices();
  }, [checkServices]);

  return {
    ...state,
    recheckServices: checkServices,
  };
}
