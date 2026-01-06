import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto py-16 px-4">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            MockView
          </h1>
          <p className="text-xl text-gray-400">
            AI-Powered Interview Preparation Platform
          </p>
        </header>

        {/* Main content */}
        <main className="space-y-12">
          {/* Description */}
          <section className="text-center max-w-2xl mx-auto">
            <p className="text-lg text-gray-300 leading-relaxed">
              Upload your CV and target job description to receive a compatibility
              score and practice with an AI interviewer. Get personalized feedback
              and improve your interview skills.
            </p>
          </section>

          {/* Features */}
          <section className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-3xl mb-4">📄</div>
              <h3 className="text-lg font-semibold mb-2">Smart CV Analysis</h3>
              <p className="text-gray-400 text-sm">
                Upload your CV and get instant parsing of skills, experience,
                and qualifications using AI.
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-3xl mb-4">🎯</div>
              <h3 className="text-lg font-semibold mb-2">Match Scoring</h3>
              <p className="text-gray-400 text-sm">
                See how well your profile matches the job requirements with
                detailed breakdown and gap analysis.
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="text-3xl mb-4">🎤</div>
              <h3 className="text-lg font-semibold mb-2">Voice Interview</h3>
              <p className="text-gray-400 text-sm">
                Practice with voice-enabled mock interviews that adapt to
                your responses in real-time.
              </p>
            </div>
          </section>

          {/* CTA Button */}
          <section className="text-center">
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Get Started
              <span className="text-xl">→</span>
            </Link>
          </section>

          {/* Privacy notice */}
          <section className="text-center max-w-xl mx-auto">
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-sm text-gray-400">
                <span className="text-green-400 mr-2">🔒</span>
                Your data is processed locally and auto-deleted after 24 hours.
                No account required. All AI inference runs on your own hardware.
              </p>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-700 text-center text-sm text-gray-500">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/status" className="hover:text-gray-300">
              System Status
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300"
            >
              GitHub
            </a>
          </div>
          <p>MockView - Open Source Interview Prep Platform</p>
        </footer>
      </div>
    </div>
  );
}
