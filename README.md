# MockView

AI-Powered Interview Preparation Platform

MockView is a self-hosted, open-source platform that helps job applicants prepare for interviews through AI-driven mock sessions. Upload your CV and job description to receive a compatibility score, then practice with an adaptive voice-enabled mock interview.

## Features

- **Smart CV Analysis**: AI-powered extraction of skills, experience, and qualifications
- **Job Description Parsing**: Understand role requirements and competency areas
- **Match Scoring**: See how well your profile matches with detailed breakdown
- **Adaptive Interviews**: Voice-enabled mock interviews that adapt to your responses
- **Comprehensive Assessment**: Get detailed feedback and improvement recommendations

## Privacy First

- All AI inference runs locally (Ollama, Whisper, Coqui TTS)
- Data auto-deletes after 24 hours
- No account required
- No cloud dependencies

## Tech Stack

- **Frontend**: Next.js 14+, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Sequelize ORM
- **Database**: PostgreSQL
- **AI Services**:
  - Ollama for LLM inference
  - Faster-Whisper for speech-to-text
  - Coqui TTS for text-to-speech

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- Sufficient RAM for AI models (64GB recommended for 70B models)

### Running with Docker Compose

```bash
# Clone the repository
git clone https://github.com/yourusername/mockview.git
cd mockview

# Copy environment file
cp .env.example .env.local

# Start all services
docker-compose up -d

# The application will be available at http://localhost:3000
```

### Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start PostgreSQL (via Docker or local installation)
docker-compose up -d postgres

# Run database migrations
npm run db:sync

# Start development server
npm run dev
```

### Pulling AI Models

Before using the platform, you'll need to pull the required Ollama models:

```bash
# Connect to Ollama container
docker exec -it mockview-ollama ollama pull llama3.1:8b-instruct-q8_0
docker exec -it mockview-ollama ollama pull llama3.1:70b-instruct-q4_K_M
```

## Project Structure

```
mockview/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API Routes
│   │   └── status/       # Status page
│   ├── components/       # React components
│   ├── lib/
│   │   ├── ai/           # LLM orchestration
│   │   ├── db/           # Database models
│   │   ├── services/     # Business logic
│   │   └── types/        # TypeScript definitions
│   └── prompts/          # LLM prompt templates
├── docker/               # Dockerfiles
├── scripts/              # Utility scripts
└── data/                 # Runtime data (uploads, audio)
```

## Configuration

See `.env.example` for all configuration options. Key settings:

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL_LIGHT` | Model for parsing tasks | `llama3.1:8b-instruct-q8_0` |
| `OLLAMA_MODEL_HEAVY` | Model for generation/evaluation | `llama3.1:70b-instruct-q4_K_M` |
| `SESSION_EXPIRY_HOURS` | Session auto-delete time | `24` |
| `MIN_MATCH_SCORE_FOR_INTERVIEW` | Minimum score for interview | `50` |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check |
| `/api/session` | POST | Create new session |
| `/api/cv/upload` | POST | Upload CV document |
| `/api/jd/submit` | POST | Submit job description |
| `/api/match/calculate` | POST | Calculate compatibility score |
| `/api/interview/start` | POST | Start mock interview |
| `/api/interview/answer` | POST | Submit answer |
| `/api/summary/get` | GET | Get interview summary |

## Development Status

### Phase 1: Infrastructure ✅
- [x] Project scaffolding
- [x] Docker Compose setup
- [x] Database schema
- [x] Health check endpoints
- [x] Status page

### Phase 2: Document Processing 🚧
- [ ] Session management
- [ ] CV upload and parsing
- [ ] JD parsing

### Phase 3-7: Coming Soon
- Match scoring
- Interview engine
- Voice integration
- Summary generation
- Cleanup system

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## License

MIT License - see LICENSE file for details.
