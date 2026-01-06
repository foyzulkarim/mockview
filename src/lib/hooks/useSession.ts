'use client';

import { useState, useEffect, useCallback } from 'react';

const SESSION_KEY = 'mockview_session';

interface SessionState {
  uuid: string | null;
  expiresAt: Date | null;
  isLoading: boolean;
  error: string | null;
}

export function useSession() {
  const [state, setState] = useState<SessionState>({
    uuid: null,
    expiresAt: null,
    isLoading: true,
    error: null,
  });

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const { uuid, expiresAt } = JSON.parse(stored);
        const expiry = new Date(expiresAt);

        // Check if session is still valid
        if (expiry > new Date()) {
          setState({
            uuid,
            expiresAt: expiry,
            isLoading: false,
            error: null,
          });
          return;
        } else {
          // Session expired, clear it
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  // Create a new session
  const createSession = useCallback(async (): Promise<string> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/session', {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create session');
      }

      const { uuid, expiresAt } = data.data;

      // Store in localStorage
      localStorage.setItem(SESSION_KEY, JSON.stringify({ uuid, expiresAt }));

      setState({
        uuid,
        expiresAt: new Date(expiresAt),
        isLoading: false,
        error: null,
      });

      return uuid;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create session';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      throw error;
    }
  }, []);

  // Ensure session exists (create if needed)
  const ensureSession = useCallback(async (): Promise<string> => {
    if (state.uuid && state.expiresAt && state.expiresAt > new Date()) {
      return state.uuid;
    }
    return createSession();
  }, [state.uuid, state.expiresAt, createSession]);

  // Clear session (for starting fresh)
  const clearSession = useCallback(async () => {
    if (state.uuid) {
      try {
        await fetch(`/api/session?uuid=${state.uuid}`, {
          method: 'DELETE',
        });
      } catch {
        // Ignore errors when clearing
      }
    }

    localStorage.removeItem(SESSION_KEY);
    setState({
      uuid: null,
      expiresAt: null,
      isLoading: false,
      error: null,
    });
  }, [state.uuid]);

  // Calculate time remaining
  const getTimeRemaining = useCallback((): string | null => {
    if (!state.expiresAt) return null;

    const now = new Date();
    const diff = state.expiresAt.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  }, [state.expiresAt]);

  return {
    uuid: state.uuid,
    expiresAt: state.expiresAt,
    isLoading: state.isLoading,
    error: state.error,
    createSession,
    ensureSession,
    clearSession,
    getTimeRemaining,
  };
}
