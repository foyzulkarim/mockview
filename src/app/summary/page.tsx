'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/hooks/useSession';
import type { InterviewSummary } from '@/lib/types';

// Rating badge component
function RatingBadge({ rating }: { rating: InterviewSummary['overall_rating'] }) {
  const config = {
    excellent: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50', label: 'Excellent' },
    good: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50', label: 'Good' },
    satisfactory: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50', label: 'Satisfactory' },
    needs_improvement: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50', label: 'Needs Improvement' },
  };

  const c = config[rating];

  return (
    <span className={`px-4 py-2 text-lg font-medium rounded-lg border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  );
}

// Score ring component
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 65) return 'text-blue-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`${getColor(score)} transition-all duration-1000`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-white">{score}%</span>
      </div>
    </div>
  );
}

// Communication score bar
function CommunicationBar({ label, score }: { label: string; score: number }) {
  const percentage = (score / 5) * 100;

  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-sm text-gray-400">{score}/5</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function SummaryPage() {
  const router = useRouter();
  const { uuid, ensureSession, getTimeRemaining, clearSession } = useSession();

  const [summary, setSummary] = useState<InterviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch or generate summary
  const fetchSummary = useCallback(async (sessionUuid: string) => {
    try {
      // First try to get existing summary
      const getResponse = await fetch(`/api/summary?sessionUuid=${sessionUuid}`);
      const getData = await getResponse.json();

      if (getData.success) {
        setSummary(getData.data.summary);
        setLoading(false);
        return;
      }

      // If no summary exists, generate one
      if (getData.error?.code === 'SUMMARY_NOT_FOUND') {
        setGenerating(true);
        setLoading(false);

        const genResponse = await fetch('/api/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionUuid }),
        });

        const genData = await genResponse.json();

        if (genData.success) {
          setSummary(genData.data.summary);
        } else {
          throw new Error(genData.error?.message || 'Failed to generate summary');
        }
      } else {
        throw new Error(getData.error?.message || 'Failed to fetch summary');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const sessionUuid = await ensureSession();
        await fetchSummary(sessionUuid);
      } catch {
        setError('No session found. Please start from the beginning.');
        setLoading(false);
      }
    };

    init();
  }, [ensureSession, fetchSummary]);

  const handleStartNew = async () => {
    await clearSession();
    router.push('/upload');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading your results...</p>
        </div>
      </div>
    );
  }

  // Generating state
  if (generating) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-xl font-medium text-white mb-2">Analyzing your interview...</p>
          <p className="text-gray-400">
            We&apos;re generating a detailed performance summary. This may take 30-60 seconds.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="text-red-400 text-6xl mb-4">&#9888;</div>
          <p className="text-xl font-medium text-white mb-2">Something went wrong</p>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            href="/interview"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Back to Interview
          </Link>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <p className="text-xl text-white mb-4">No summary available</p>
          <Link
            href="/interview"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Complete Interview First
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Interview Summary</h1>
          <RatingBadge rating={summary.overall_rating} />
        </div>

        {/* Overall Score & Stats */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row items-center justify-around gap-6">
            <div className="text-center">
              <ScoreRing score={summary.overall_score} />
              <p className="mt-2 text-gray-400">Overall Score</p>
            </div>
            <div className="text-center space-y-3">
              <div>
                <p className="text-3xl font-bold text-white">{summary.questions_answered}</p>
                <p className="text-sm text-gray-400">Questions Answered</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{summary.duration_minutes} min</p>
                <p className="text-sm text-gray-400">Interview Duration</p>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Executive Summary</h2>
          <p className="text-gray-300 leading-relaxed">{summary.executive_summary}</p>
        </div>

        {/* Strengths */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-green-400">Strengths</h2>
          <div className="space-y-4">
            {summary.strengths.map((strength, index) => (
              <div key={index} className="border-l-2 border-green-500 pl-4">
                <h3 className="font-medium text-white">{strength.area}</h3>
                <p className="text-sm text-gray-400 mt-1">{strength.evidence}</p>
                <p className="text-sm text-green-400/80 mt-1">Impact: {strength.impact}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Areas for Improvement */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-yellow-400">Areas for Improvement</h2>
          <div className="space-y-4">
            {summary.areas_for_improvement.map((area, index) => (
              <div key={index} className="border-l-2 border-yellow-500 pl-4">
                <h3 className="font-medium text-white">{area.area}</h3>
                <p className="text-sm text-gray-400 mt-1">{area.issue}</p>
                <p className="text-sm text-yellow-400/80 mt-1">Suggestion: {area.suggestion}</p>
                {area.resources && area.resources.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Resources: {area.resources.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Competency Scores */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Competency Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(summary.competency_scores).map(([name, data]) => (
              <div key={name} className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium text-white">{name}</h3>
                  <span className={`text-lg font-bold ${
                    data.score >= 4 ? 'text-green-400' :
                    data.score >= 3 ? 'text-blue-400' :
                    data.score >= 2 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {data.score}/5
                  </span>
                </div>
                <p className="text-sm text-gray-400">{data.summary}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Communication Feedback */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Communication Skills</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <CommunicationBar label="Clarity" score={summary.communication_feedback.clarity} />
              <CommunicationBar label="Structure" score={summary.communication_feedback.structure} />
              <CommunicationBar label="Confidence" score={summary.communication_feedback.confidence} />
              <CommunicationBar label="Use of Examples" score={summary.communication_feedback.examples_usage} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{summary.communication_feedback.notes}</p>
            </div>
          </div>
        </div>

        {/* Recommended Next Steps */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Recommended Next Steps</h2>
          <ol className="space-y-3">
            {summary.recommended_next_steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <span className="text-gray-300">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Sample Improved Answers */}
        {summary.sample_improved_answers && summary.sample_improved_answers.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Model Answer Example</h2>
            {summary.sample_improved_answers.map((sample, index) => (
              <div key={index} className="space-y-3">
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">Question:</p>
                  <p className="text-white">{sample.question}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-sm text-green-400 mb-2">Strong Answer Example:</p>
                  <p className="text-gray-300">{sample.improved_answer}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <button
            onClick={handleStartNew}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Start New Interview
          </button>
          <Link
            href="/score"
            className="px-8 py-3 border border-gray-600 hover:border-gray-500 text-gray-300 font-semibold rounded-lg text-center transition-colors"
          >
            View Match Score
          </Link>
        </div>

        {/* Session info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>{getTimeRemaining()}</p>
        </div>
      </div>
    </div>
  );
}
