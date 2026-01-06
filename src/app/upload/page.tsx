'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileDropzone } from '@/components/FileDropzone';
import { useSession } from '@/lib/hooks/useSession';

type Step = 'upload' | 'processing' | 'error';

interface ProcessingState {
  step: Step;
  message: string;
  progress: number;
}

export default function UploadPage() {
  const router = useRouter();
  const { ensureSession, getTimeRemaining } = useSession();

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [processing, setProcessing] = useState<ProcessingState>({
    step: 'upload',
    message: '',
    progress: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    setCvFile(file);
    setError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cvFile) {
      setError('Please upload your CV');
      return;
    }

    if (jobDescription.trim().length < 50) {
      setError('Please provide a more detailed job description (at least 50 characters)');
      return;
    }

    setError(null);
    setProcessing({ step: 'processing', message: 'Creating session...', progress: 10 });

    try {
      // Ensure we have a session
      const sessionUuid = await ensureSession();

      // Upload CV
      setProcessing({ step: 'processing', message: 'Uploading CV...', progress: 20 });

      const cvFormData = new FormData();
      cvFormData.append('file', cvFile);
      cvFormData.append('sessionUuid', sessionUuid);

      const cvResponse = await fetch('/api/cv/upload', {
        method: 'POST',
        body: cvFormData,
      });

      const cvData = await cvResponse.json();

      if (!cvData.success) {
        throw new Error(cvData.error?.message || 'CV upload failed');
      }

      setProcessing({ step: 'processing', message: 'Analysing your CV...', progress: 40 });

      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));

      // Submit job description
      setProcessing({ step: 'processing', message: 'Parsing job description...', progress: 60 });

      const jdResponse = await fetch('/api/jd/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionUuid,
          jobDescription,
        }),
      });

      const jdData = await jdResponse.json();

      if (!jdData.success) {
        throw new Error(jdData.error?.message || 'Job description submission failed');
      }

      setProcessing({ step: 'processing', message: 'Preparing results...', progress: 80 });

      // Small delay before redirect
      await new Promise(resolve => setTimeout(resolve, 500));

      setProcessing({ step: 'processing', message: 'Complete!', progress: 100 });

      // Redirect to score page
      router.push('/score');
    } catch (err) {
      console.error('Upload error:', err);
      setProcessing({ step: 'error', message: '', progress: 0 });
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const isFormValid = cvFile && jobDescription.trim().length >= 50;
  const isProcessing = processing.step === 'processing';

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block">
            &larr; Back to Home
          </Link>
          <h1 className="text-3xl font-bold mb-2">Upload Your Documents</h1>
          <p className="text-gray-400">
            Upload your CV and paste the job description to get started
          </p>
        </div>

        {/* Processing overlay */}
        {isProcessing && (
          <div className="fixed inset-0 bg-gray-900/90 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 text-center">
              <div className="mb-6">
                <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
              </div>
              <p className="text-lg font-medium mb-4">{processing.message}</p>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${processing.progress}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                This may take 30-60 seconds
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* CV Upload */}
          <div>
            <label className="block text-lg font-medium mb-4">
              1. Upload Your CV
            </label>
            <FileDropzone
              onFileSelect={handleFileSelect}
              acceptedTypes={['.pdf', '.txt']}
              maxSizeMB={5}
              disabled={isProcessing}
            />
          </div>

          {/* Job Description */}
          <div>
            <label htmlFor="jobDescription" className="block text-lg font-medium mb-4">
              2. Paste the Job Description
            </label>
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              disabled={isProcessing}
              rows={12}
              className={`
                w-full bg-gray-800 border border-gray-700 rounded-lg p-4
                text-white placeholder-gray-500
                focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed
                resize-none
              `}
            />
            <p className="mt-2 text-sm text-gray-500">
              {jobDescription.length} / 50 minimum characters
              {jobDescription.length >= 50 && (
                <span className="text-green-400 ml-2">&#10003;</span>
              )}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-900/30 border border-red-500 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={!isFormValid || isProcessing}
              className={`
                px-8 py-3 rounded-lg font-semibold transition-all
                ${isFormValid && !isProcessing
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              Analyse My Fit &rarr;
            </button>

            <p className="text-sm text-gray-500">
              {getTimeRemaining() || 'Session will be created on submit'}
            </p>
          </div>
        </form>

        {/* Privacy notice */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            <span className="text-green-400 mr-2">&#128274;</span>
            Your data is processed locally and auto-deleted after 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
