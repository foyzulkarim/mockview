'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/lib/hooks/useSession';
import type { MatchBreakdown } from '@/lib/types';

interface ScoreData {
  overallScore: number;
  breakdown: MatchBreakdown;
  canStartInterview: boolean;
}

// Progress bar component
function ProgressBar({ score, label }: { score: number; label: string }) {
  const getColorClass = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-sm text-gray-400">{score}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        <div
          className={`${getColorClass(score)} h-2.5 rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// Circular progress component
function CircularProgress({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColorClass = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getMessage = (score: number) => {
    if (score >= 80) return 'Excellent match!';
    if (score >= 60) return 'Good match';
    if (score >= 50) return 'Moderate match';
    return 'Needs improvement';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg className="transform -rotate-90 w-40 h-40">
          <circle
            cx="80"
            cy="80"
            r="45"
            stroke="currentColor"
            strokeWidth="10"
            fill="transparent"
            className="text-gray-700"
          />
          <circle
            cx="80"
            cy="80"
            r="45"
            stroke="currentColor"
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`${getColorClass(score)} transition-all duration-1000`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold text-white">{score}%</span>
        </div>
      </div>
      <p className={`mt-4 text-lg font-medium ${getColorClass(score)}`}>
        {getMessage(score)}
      </p>
    </div>
  );
}

export default function ScorePage() {
  const router = useRouter();
  const { uuid, ensureSession, getTimeRemaining } = useSession();

  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch or calculate score
  const fetchScore = useCallback(async (sessionUuid: string) => {
    try {
      // First try to get existing score
      const getResponse = await fetch(`/api/match/calculate?sessionUuid=${sessionUuid}`);
      const getData = await getResponse.json();

      if (getData.success) {
        setScoreData(getData.data);
        setLoading(false);
        return;
      }

      // If score doesn't exist, calculate it
      if (getData.error?.code === 'SCORE_NOT_FOUND') {
        setCalculating(true);
        setLoading(false);

        const calcResponse = await fetch('/api/match/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionUuid }),
        });

        const calcData = await calcResponse.json();

        if (calcData.success) {
          setScoreData(calcData.data);
        } else {
          throw new Error(calcData.error?.message || 'Failed to calculate match score');
        }
      } else {
        throw new Error(getData.error?.message || 'Failed to fetch score');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCalculating(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const sessionUuid = await ensureSession();
        await fetchScore(sessionUuid);
      } catch (err) {
        setError('No session found. Please start from the beginning.');
        setLoading(false);
      }
    };

    init();
  }, [ensureSession, fetchScore]);

  const handleStartInterview = () => {
    router.push('/interview');
  };

  const handleUploadDifferent = () => {
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

  // Calculating state
  if (calculating) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-xl font-medium text-white mb-2">Calculating your match...</p>
          <p className="text-gray-400">
            We&apos;re comparing your CV against the job requirements.
            This typically takes 30-60 seconds.
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
            href="/upload"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Start Over
          </Link>
        </div>
      </div>
    );
  }

  if (!scoreData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <p className="text-xl text-white mb-4">No score data available</p>
          <Link
            href="/upload"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Upload Documents
          </Link>
        </div>
      </div>
    );
  }

  const { overallScore, breakdown, canStartInterview } = scoreData;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/upload" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">
            &larr; Back to Upload
          </Link>
          <h1 className="text-3xl font-bold mb-2">Your Match Score</h1>
        </div>

        {/* Overall Score */}
        <div className="bg-gray-800 rounded-lg p-8 mb-8 text-center">
          <CircularProgress score={overallScore} />
        </div>

        {/* Score Breakdown */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">Score Breakdown</h2>

          <ProgressBar
            score={breakdown.technical_skills.score}
            label="Technical Skills"
          />
          <ProgressBar
            score={breakdown.experience_level.score}
            label="Experience Level"
          />
          <ProgressBar
            score={breakdown.required_technologies.score}
            label="Required Technologies"
          />
          <ProgressBar
            score={breakdown.soft_skills.score}
            label="Soft Skills"
          />
        </div>

        {/* Strengths */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-green-400">&#10003; Strengths</h2>
          <ul className="space-y-2">
            {breakdown.strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-green-400 mt-1">&#8226;</span>
                <span className="text-gray-300">{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Gaps */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-yellow-400">&#9888; Areas to Address</h2>
          <ul className="space-y-2">
            {breakdown.gaps.map((gap, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">&#8226;</span>
                <span className="text-gray-300">{gap}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {canStartInterview ? (
            <button
              onClick={handleStartInterview}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Start Mock Interview &rarr;
            </button>
          ) : (
            <div className="text-center">
              <button
                disabled
                className="px-8 py-3 bg-gray-700 text-gray-400 font-semibold rounded-lg cursor-not-allowed"
              >
                Interview Unavailable
              </button>
              <p className="text-sm text-gray-500 mt-2">
                Score of 50% or higher required for mock interview
              </p>
            </div>
          )}

          <button
            onClick={handleUploadDifferent}
            className="px-8 py-3 border border-gray-600 hover:border-gray-500 text-gray-300 font-semibold rounded-lg transition-colors"
          >
            Upload Different CV
          </button>
        </div>

        {/* Session info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>{getTimeRemaining()}</p>
        </div>
      </div>
    </div>
  );
}
