'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/hooks/useSession';
import { useVoiceServices } from '@/lib/hooks/useVoiceServices';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { AudioPlayer } from '@/components/AudioPlayer';
import type { AnswerEvaluation } from '@/lib/types';

type InputMode = 'text' | 'voice';

interface Question {
  id: number;
  text: string;
  competency: string;
  isFollowUp?: boolean;
  depth?: number;
}

interface Progress {
  current: number;
  estimated_total: number;
  competency: string;
}

interface InterviewState {
  status: 'loading' | 'starting' | 'answering' | 'evaluating' | 'complete' | 'error';
  interviewId: number | null;
  currentQuestion: Question | null;
  progress: Progress | null;
  lastEvaluation: AnswerEvaluation | null;
  error: string | null;
}

// Score badge component
function ScoreBadge({ score }: { score: number }) {
  const getColorClass = (score: number) => {
    if (score >= 4) return 'bg-green-500/20 text-green-400 border-green-500/50';
    if (score >= 3) return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    if (score >= 2) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    return 'bg-red-500/20 text-red-400 border-red-500/50';
  };

  const getLabel = (score: number) => {
    if (score >= 4) return 'Strong';
    if (score >= 3) return 'Good';
    if (score >= 2) return 'Okay';
    return 'Weak';
  };

  return (
    <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getColorClass(score)}`}>
      {getLabel(score)} ({score}/5)
    </span>
  );
}

// Progress indicator component
function ProgressIndicator({ progress }: { progress: Progress }) {
  const percentage = Math.round((progress.current / progress.estimated_total) * 100);

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-400">
          Question {progress.current} of ~{progress.estimated_total}
        </span>
        <span className="text-sm text-blue-400">{progress.competency}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Evaluation display component
function EvaluationDisplay({ evaluation }: { evaluation: AnswerEvaluation }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm text-gray-400">Last Answer:</span>
        <ScoreBadge score={evaluation.overall_score} />
      </div>
      <p className="text-sm text-gray-300 leading-relaxed">{evaluation.reasoning}</p>
    </div>
  );
}

export default function InterviewPage() {
  const router = useRouter();
  const { uuid, ensureSession, getTimeRemaining } = useSession();
  const { voiceEnabled, sttAvailable, ttsAvailable, isChecking: isCheckingVoice } = useVoiceServices();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const answerStartTimeRef = useRef<number>(0);

  const [state, setState] = useState<InterviewState>({
    status: 'loading',
    interviewId: null,
    currentQuestion: null,
    progress: null,
    lastEvaluation: null,
    error: null,
  });

  const [answerText, setAnswerText] = useState('');
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [autoPlayTTS, setAutoPlayTTS] = useState(false);

  // Start or resume interview
  const initializeInterview = useCallback(async (sessionUuid: string) => {
    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      // First check if there's an existing interview
      const stateResponse = await fetch(`/api/interview/state?sessionUuid=${sessionUuid}`);
      const stateData = await stateResponse.json();

      if (stateData.success && stateData.data.status === 'in_progress' && stateData.data.currentQuestion) {
        // Resume existing interview
        setState({
          status: 'answering',
          interviewId: stateData.data.interviewId,
          currentQuestion: stateData.data.currentQuestion,
          progress: stateData.data.progress,
          lastEvaluation: null,
          error: null,
        });
        answerStartTimeRef.current = Date.now();
        return;
      }

      // Start new interview
      setState(prev => ({ ...prev, status: 'starting' }));

      const startResponse = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionUuid }),
      });

      const startData = await startResponse.json();

      if (!startData.success) {
        throw new Error(startData.error?.message || 'Failed to start interview');
      }

      setState({
        status: 'answering',
        interviewId: startData.data.interviewId,
        currentQuestion: startData.data.question,
        progress: startData.data.progress,
        lastEvaluation: null,
        error: null,
      });
      answerStartTimeRef.current = Date.now();
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to initialize interview',
      }));
    }
  }, []);

  // Submit answer
  const submitAnswer = useCallback(async () => {
    if (!uuid || !state.currentQuestion || !answerText.trim()) return;

    const responseTimeMs = Date.now() - answerStartTimeRef.current;
    setState(prev => ({ ...prev, status: 'evaluating' }));

    try {
      const response = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionUuid: uuid,
          questionId: state.currentQuestion.id,
          answerText: answerText.trim(),
          responseTimeMs,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to submit answer');
      }

      setAnswerText('');

      if (data.data.isComplete) {
        setState(prev => ({
          ...prev,
          status: 'complete',
          lastEvaluation: data.data.evaluation,
          progress: data.data.progress,
        }));
      } else {
        setState(prev => ({
          ...prev,
          status: 'answering',
          currentQuestion: data.data.nextQuestion,
          progress: data.data.progress,
          lastEvaluation: data.data.evaluation,
        }));
        answerStartTimeRef.current = Date.now();
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to submit answer',
      }));
    }
  }, [uuid, state.currentQuestion, answerText]);

  // Handle voice transcription
  const handleTranscription = useCallback((text: string) => {
    setAnswerText(prev => prev ? `${prev} ${text}` : text);
  }, []);

  // Finish interview early
  const finishInterview = useCallback(async () => {
    if (!uuid) return;

    try {
      const response = await fetch('/api/interview/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionUuid: uuid }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to finish interview');
      }

      setState(prev => ({ ...prev, status: 'complete' }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to finish interview',
      }));
    }
  }, [uuid]);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        const sessionUuid = await ensureSession();
        await initializeInterview(sessionUuid);
      } catch {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'No session found. Please upload your documents first.',
        }));
      }
    };

    init();
  }, [ensureSession, initializeInterview]);

  // Focus textarea when question changes
  useEffect(() => {
    if (state.status === 'answering' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [state.status, state.currentQuestion?.id]);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (state.status === 'answering' && answerText.trim()) {
          e.preventDefault();
          submitAnswer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.status, answerText, submitAnswer]);

  // Loading state
  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  // Starting state
  if (state.status === 'starting') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-xl font-medium text-white mb-2">Starting your interview...</p>
          <p className="text-gray-400">
            We&apos;re generating personalized questions based on your CV and the job description.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="text-red-400 text-6xl mb-4">&#9888;</div>
          <p className="text-xl font-medium text-white mb-2">Something went wrong</p>
          <p className="text-gray-400 mb-6">{state.error}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => uuid && initializeInterview(uuid)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Try Again
            </button>
            <Link
              href="/score"
              className="px-6 py-3 border border-gray-600 hover:border-gray-500 text-gray-300 rounded-lg text-center"
            >
              Back to Score
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Complete state
  if (state.status === 'complete') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-lg mx-4">
          <div className="text-green-400 text-6xl mb-4">&#10003;</div>
          <h1 className="text-3xl font-bold text-white mb-4">Interview Complete!</h1>
          <p className="text-gray-400 mb-8">
            Great job completing your mock interview. Your responses have been recorded and evaluated.
          </p>

          {state.lastEvaluation && (
            <div className="mb-8">
              <p className="text-sm text-gray-500 mb-2">Final answer score:</p>
              <ScoreBadge score={state.lastEvaluation.overall_score} />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/summary"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
            >
              View Summary &rarr;
            </Link>
            <Link
              href="/score"
              className="px-8 py-3 border border-gray-600 hover:border-gray-500 text-gray-300 rounded-lg"
            >
              Back to Score
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Answering/Evaluating state
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Link href="/score" className="text-blue-400 hover:text-blue-300 text-sm">
            &larr; Exit Interview
          </Link>
          <button
            onClick={() => setShowFinishConfirm(true)}
            className="text-sm text-gray-400 hover:text-gray-300"
          >
            Finish Early
          </button>
        </div>

        {/* Progress */}
        {state.progress && <ProgressIndicator progress={state.progress} />}

        {/* Last evaluation */}
        {state.lastEvaluation && <EvaluationDisplay evaluation={state.lastEvaluation} />}

        {/* Current Question */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">&#128172;</span>
              <span className="text-sm text-gray-400">
                {state.currentQuestion?.isFollowUp ? 'Follow-up Question' : 'Question'}
              </span>
            </div>
            {/* TTS audio player */}
            {ttsAvailable && uuid && state.currentQuestion && (
              <AudioPlayer
                text={state.currentQuestion.text}
                sessionUuid={uuid}
                autoPlay={autoPlayTTS}
                disabled={state.status === 'evaluating'}
              />
            )}
          </div>
          <p className="text-lg text-white leading-relaxed">
            {state.currentQuestion?.text}
          </p>
        </div>

        {/* Input Mode Toggle */}
        {sttAvailable && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => setInputMode('text')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                inputMode === 'text'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Text Input
            </button>
            <button
              onClick={() => setInputMode('voice')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                inputMode === 'voice'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Voice Input
            </button>
            {ttsAvailable && (
              <label className="flex items-center gap-2 text-sm text-gray-400 ml-4">
                <input
                  type="checkbox"
                  checked={autoPlayTTS}
                  onChange={(e) => setAutoPlayTTS(e.target.checked)}
                  className="rounded bg-gray-700 border-gray-600"
                />
                Auto-play questions
              </label>
            )}
          </div>
        )}

        {/* Answer Input */}
        <div className="mb-6">
          {inputMode === 'voice' && sttAvailable && uuid ? (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
              <VoiceRecorder
                onTranscription={handleTranscription}
                sessionUuid={uuid}
                questionId={state.currentQuestion?.id}
                disabled={state.status === 'evaluating'}
              />
              {answerText && (
                <div className="mt-6 p-4 bg-gray-900 rounded-lg">
                  <label className="block text-sm text-gray-400 mb-2">Transcribed Text (editable)</label>
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    disabled={state.status === 'evaluating'}
                    className="w-full h-32 bg-transparent border-0 text-white placeholder-gray-500 resize-none focus:outline-none disabled:opacity-50"
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              <label className="block text-sm text-gray-400 mb-2">Your Answer</label>
              <textarea
                ref={textareaRef}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                disabled={state.status === 'evaluating'}
                placeholder="Type your answer here... Think about specific examples and outcomes."
                className="w-full h-48 bg-gray-800 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
              <div className="flex justify-between mt-2">
                <span className="text-xs text-gray-500">
                  {answerText.length} characters
                </span>
                <span className="text-xs text-gray-500">
                  Press Cmd+Enter to submit
                </span>
              </div>
            </>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={submitAnswer}
          disabled={state.status === 'evaluating' || !answerText.trim()}
          className={`w-full py-4 rounded-lg font-semibold transition-all ${
            state.status === 'evaluating' || !answerText.trim()
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {state.status === 'evaluating' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              Evaluating your response...
            </span>
          ) : (
            'Submit Answer'
          )}
        </button>

        {/* Session info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>{getTimeRemaining()}</p>
        </div>
      </div>

      {/* Finish Confirmation Modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">Finish Interview Early?</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to end the interview now? You&apos;ve completed {state.progress?.current || 0} of ~{state.progress?.estimated_total || 0} questions.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="flex-1 py-2 border border-gray-600 hover:border-gray-500 text-gray-300 rounded-lg"
              >
                Continue Interview
              </button>
              <button
                onClick={() => {
                  setShowFinishConfirm(false);
                  finishInterview();
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Finish Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
