# AI-Powered CV Interview Platform — Technical Architecture

## Executive Summary

This document outlines the technical architecture for a self-hosted, open-source platform that helps job applicants prepare for interviews through AI-driven mock sessions. The platform accepts a CV and job description, calculates a compatibility score, and conducts an adaptive voice-enabled mock interview that mimics real-world hiring conversations.

The core principles guiding this architecture are genuine applicant value, complete privacy through ephemeral data (24-hour auto-deletion), zero authentication friction, and full local AI inference for independence from cloud providers.

---

## 1. High-Level System Overview

### 1.1 Core User Journey

The platform delivers value through a five-stage funnel that progressively qualifies and prepares applicants.

**Stage 1 — Document Submission:** The applicant uploads their CV (PDF or plain text) alongside the target job description. No account creation is required; the system generates a unique session identifier stored in the browser's localStorage.

**Stage 2 — Intelligent Parsing:** The system extracts structured information from both documents: skills, experience levels, technologies, and role requirements. This parsing goes beyond keyword extraction to understand context, seniority signals, and implicit requirements.

**Stage 3 — Compatibility Scoring:** A match algorithm compares the parsed CV against job requirements, producing a percentage score with a detailed breakdown. This helps applicants understand their positioning before investing time in the mock interview.

**Stage 4 — Adaptive Mock Interview:** For applicants scoring above 50%, the platform conducts a voice-enabled interview. Questions are generated dynamically based on the specific CV-JD combination, played as audio, and follow-up questions adapt based on response quality. The interview covers all relevant competency areas proportional to their importance in the job description.

**Stage 5 — Comprehensive Debrief:** Upon completion, the applicant receives a detailed summary including an overall readiness score, per-competency assessments, specific improvement suggestions, and a clear recommendation on whether they appear ready to proceed to real interviews.

### 1.2 Architectural Philosophy

The system follows a modular monolith pattern rather than microservices. Given the single-user-at-a-time tolerance and self-hosted nature, this reduces operational complexity while maintaining clean separation of concerns. The architecture prioritises inference quality over speed, accepting loading states and timeouts as acceptable trade-offs for running powerful local models.

All AI inference happens locally through Ollama for LLMs, Whisper for speech-to-text, and Coqui XTTS or Piper for text-to-speech. This ensures complete data privacy and eliminates ongoing API costs, making the platform truly self-sufficient.

---

## 2. Component Architecture

### 2.1 System Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BROWSER                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Upload Module  │  │ Interview UI    │  │  Results Dashboard          │  │
│  │  - CV dropzone  │  │ - Audio player  │  │  - Score breakdown          │  │
│  │  - JD textarea  │  │ - Voice record  │  │  - Competency charts        │  │
│  │  - Format valid │  │ - Text fallback │  │  - Recommendation           │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘  │
│           │                    │                          │                  │
│           │         localStorage: { sessionUUID }         │                  │
└───────────┼────────────────────┼──────────────────────────┼──────────────────┘
            │                    │                          │
            ▼                    ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEXT.JS APPLICATION                                │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         API ROUTES LAYER                              │   │
│  │  /api/session/create    → Creates new session, returns UUID          │   │
│  │  /api/cv/upload         → Accepts CV, triggers parsing pipeline      │   │
│  │  /api/jd/submit         → Accepts JD, triggers parsing               │   │
│  │  /api/match/calculate   → Runs compatibility scoring                 │   │
│  │  /api/interview/start   → Initialises interview, generates Q1        │   │
│  │  /api/interview/answer  → Processes answer, decides next action      │   │
│  │  /api/interview/next    → Retrieves next question with audio         │   │
│  │  /api/interview/finish  → Triggers summary generation                │   │
│  │  /api/summary/get       → Returns final assessment                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌─────────────────────────────────┼─────────────────────────────────────┐  │
│  │                    SERVICE ORCHESTRATION LAYER                        │  │
│  │                                 │                                     │  │
│  │  ┌──────────────┐  ┌───────────┴───────────┐  ┌──────────────────┐   │  │
│  │  │   Session    │  │    Interview State    │  │     Cleanup      │   │  │
│  │  │   Manager    │  │       Manager         │  │    Scheduler     │   │  │
│  │  │              │  │                       │  │                  │   │  │
│  │  │ - UUID gen   │  │ - Tracks Q&A history  │  │ - 24hr TTL check │   │  │
│  │  │ - Expiry     │  │ - Follow-up depth     │  │ - File deletion  │   │  │
│  │  │ - Validation │  │ - Competency coverage │  │ - DB cleanup     │   │  │
│  │  └──────────────┘  └───────────────────────┘  └──────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│  ┌─────────────────────────────────┼─────────────────────────────────────┐  │
│  │                       AI SERVICES LAYER                               │  │
│  │                                 │                                     │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │                    LLM Orchestrator                             │  │  │
│  │  │         (Handles all Ollama interactions with retry)           │  │  │
│  │  └─────────────────────────────┬──────────────────────────────────┘  │  │
│  │                                │                                     │  │
│  │   ┌────────────┐  ┌────────────┼────────────┐  ┌─────────────────┐   │  │
│  │   │ CV Parser  │  │  Question  │  Response  │  │    Summary      │   │  │
│  │   │            │  │  Generator │  Evaluator │  │    Generator    │   │  │
│  │   │ Extracts:  │  │            │            │  │                 │   │  │
│  │   │ - Skills   │  │ - Initial  │ - Quality  │  │ - Overall score │   │  │
│  │   │ - Exp yrs  │  │ - Followup │ - Depth    │  │ - Per-competency│   │  │
│  │   │ - Projects │  │ - Coverage │ - Keywords │  │ - Suggestions   │   │  │
│  │   │ - Seniority│  │            │            │  │ - Recommendation│   │  │
│  │   └────────────┘  └────────────┴────────────┘  └─────────────────┘   │  │
│  │                                                                       │  │
│  │   ┌─────────────────────────┐    ┌────────────────────────────────┐  │  │
│  │   │    TTS Engine           │    │       STT Engine               │  │  │
│  │   │    (Coqui XTTS/Piper)   │    │       (Whisper)                │  │  │
│  │   │                         │    │                                │  │  │
│  │   │  - Question → Audio     │    │  - User audio → Text           │  │  │
│  │   │  - Natural pacing       │    │  - Timestamp alignment         │  │  │
│  │   │  - Consistent voice     │    │  - Confidence scores           │  │  │
│  │   └─────────────────────────┘    └────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼─────────────────────────────────────────┐
│                          DATA LAYER                                          │
│                                    │                                          │
│   ┌────────────────────────────────┼────────────────────────────────────┐    │
│   │                                ▼                                    │    │
│   │  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │    │
│   │  │   PostgreSQL    │    │   File Storage  │    │   Ollama       │  │    │
│   │  │                 │    │                 │    │   Server       │  │    │
│   │  │  - Sessions     │    │  - CV files     │    │                │  │    │
│   │  │  - CVs (parsed) │    │  - Audio Q's    │    │  - Llama 3.x   │  │    │
│   │  │  - JDs (parsed) │    │  - Audio A's    │    │  - Qwen 2.5    │  │    │
│   │  │  - Interviews   │    │  - Temp uploads │    │  - Mistral     │  │    │
│   │  │  - Q&A pairs    │    │                 │    │                │  │    │
│   │  │  - Summaries    │    │  /data/uploads/ │    │  Port 11434    │  │    │
│   │  │                 │    │  /data/audio/   │    │                │  │    │
│   │  │  Port 5432      │    │                 │    │                │  │    │
│   │  └─────────────────┘    └─────────────────┘    └────────────────┘  │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    External AI Services (Local)                      │   │
│   │                                                                      │   │
│   │   ┌────────────────────────┐    ┌─────────────────────────────┐     │   │
│   │   │   Whisper Server       │    │   TTS Server                │     │   │
│   │   │   (whisper.cpp or      │    │   (Coqui XTTS or Piper)     │     │   │
│   │   │    faster-whisper)     │    │                             │     │   │
│   │   │                        │    │   HTTP API for synthesis    │     │   │
│   │   │   HTTP API for         │    │   Voice cloning optional    │     │   │
│   │   │   transcription        │    │                             │     │   │
│   │   └────────────────────────┘    └─────────────────────────────┘     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

**Session Manager** handles the lifecycle of anonymous user sessions. When a user first visits, it generates a UUID v4 identifier, creates the database record with a 24-hour expiration timestamp, and returns the UUID to be stored in localStorage. On subsequent requests, it validates the UUID exists and hasn't expired. This component never stores any personally identifiable information beyond what's in the uploaded documents.

**CV Parser** transforms raw CV documents into structured JSON. For PDFs, it first extracts text using a library like pdf-parse, then passes the text to the LLM with a carefully crafted prompt that extracts: personal skills (technical and soft), years of experience per technology, notable projects with their tech stacks, education history, employment timeline, and inferred seniority level. The parser is designed to handle messy real-world CVs with inconsistent formatting.

**JD Parser** performs similar extraction on job descriptions, identifying: required skills (distinguishing must-have from nice-to-have), experience level expectations, specific technology requirements, soft skill requirements, role responsibilities, and implicit requirements (e.g., a "fast-paced startup" implies adaptability). This parsing enables intelligent question generation that covers all job aspects.

**Match Scorer** compares parsed CV and JD data using a weighted algorithm. The scoring considers: hard skill coverage (how many required skills appear in CV), experience level alignment (over/under qualified detection), technology stack overlap, soft skill indicators, and career trajectory fit. The output includes both an overall percentage and a detailed breakdown showing strengths and gaps.

**Question Generator** creates interview questions dynamically based on the CV-JD combination. It operates in two modes: initial question generation (creating a question plan that covers all competency areas) and follow-up generation (creating deeper probes based on previous answers). Questions are tagged with competency categories to ensure complete coverage.

**Response Evaluator** assesses user answers along multiple dimensions: relevance to the question, technical accuracy, depth of explanation, use of concrete examples, and communication clarity. It outputs a quality score (1-5) that drives the adaptive follow-up logic and contributes to the final assessment.

**Interview State Manager** maintains the complex state of an ongoing interview: which questions have been asked, which competencies have been covered, the current follow-up depth for each question thread, accumulated quality scores, and the overall interview progress. This state enables the adaptive behaviour that makes interviews feel natural.

**TTS Engine** converts question text into natural-sounding audio. The system uses a consistent voice throughout the interview to maintain immersion. Audio files are generated on-demand and cached to the filesystem with the question ID as the filename, enabling replay without regeneration.

**STT Engine** transcribes user voice responses into text for evaluation. It provides word-level timestamps and confidence scores, which can be used to detect hesitation or uncertainty. The transcription is stored alongside any text responses the user provides.

**Summary Generator** synthesises all interview data into a comprehensive final report. It analyses the full question-answer history, evaluates performance across competency areas, identifies patterns (consistent strengths or weaknesses), and produces actionable recommendations. The final output includes a clear "ready/not ready" recommendation with supporting evidence.

**Cleanup Scheduler** runs as a background job (cron or node-cron) that executes every hour. It queries for sessions past their 24-hour expiration, deletes all associated database records through cascading deletes, removes uploaded CV files, removes generated audio files, and logs cleanup statistics for monitoring.

---

## 3. Data Flow Sequences

### 3.1 Document Submission and Scoring Flow

```
User                    Frontend                   API                    Services                  Database
 │                         │                        │                         │                        │
 │  Drops CV file          │                        │                         │                        │
 │────────────────────────>│                        │                         │                        │
 │                         │                        │                         │                        │
 │                         │  Check localStorage    │                         │                        │
 │                         │  for sessionUUID       │                         │                        │
 │                         │                        │                         │                        │
 │                         │  [No UUID found]       │                         │                        │
 │                         │  POST /api/session     │                         │                        │
 │                         │───────────────────────>│                         │                        │
 │                         │                        │  Generate UUID v4       │                        │
 │                         │                        │────────────────────────>│                        │
 │                         │                        │                         │  INSERT session        │
 │                         │                        │                         │───────────────────────>│
 │                         │                        │<────────────────────────│<───────────────────────│
 │                         │<───────────────────────│  { uuid: "abc-123..." } │                        │
 │                         │                        │                         │                        │
 │                         │  Store UUID in         │                         │                        │
 │                         │  localStorage          │                         │                        │
 │                         │                        │                         │                        │
 │                         │  POST /api/cv/upload   │                         │                        │
 │                         │  [multipart: file,     │                         │                        │
 │                         │   sessionUUID]         │                         │                        │
 │                         │───────────────────────>│                         │                        │
 │                         │                        │  Validate session       │                        │
 │                         │                        │  Save file to disk      │                        │
 │                         │                        │  Extract text (pdf)     │                        │
 │                         │                        │────────────────────────>│                        │
 │                         │                        │                         │                        │
 │                         │                        │         CV Parser       │                        │
 │                         │                        │         ┌───────────────┤                        │
 │                         │                        │         │ Send to LLM   │                        │
 │  [Loading indicator     │                        │         │ with parsing  │                        │
 │   "Analysing CV..."]    │                        │         │ prompt        │                        │
 │<────────────────────────│                        │         │               │                        │
 │                         │                        │         │ Receive       │                        │
 │                         │                        │         │ structured    │                        │
 │                         │                        │         │ JSON          │                        │
 │                         │                        │<────────┴───────────────│                        │
 │                         │                        │                         │  INSERT cv_data        │
 │                         │                        │                         │───────────────────────>│
 │                         │<───────────────────────│  { status: "parsed",    │                        │
 │                         │                        │    skills: [...],       │                        │
 │                         │                        │    experience: {...} }  │                        │
 │                         │                        │                         │                        │
 │  Pastes Job Description │                        │                         │                        │
 │────────────────────────>│                        │                         │                        │
 │                         │  POST /api/jd/submit   │                         │                        │
 │                         │───────────────────────>│                         │                        │
 │                         │                        │         JD Parser       │                        │
 │                         │                        │────────────────────────>│                        │
 │  [Loading indicator     │                        │         (Similar LLM    │                        │
 │   "Parsing JD..."]      │                        │          extraction)    │                        │
 │<────────────────────────│                        │<────────────────────────│                        │
 │                         │                        │                         │  INSERT jd_data        │
 │                         │                        │                         │───────────────────────>│
 │                         │<───────────────────────│  { status: "parsed" }   │                        │
 │                         │                        │                         │                        │
 │                         │  POST /api/match/calc  │                         │                        │
 │                         │───────────────────────>│                         │                        │
 │                         │                        │       Match Scorer      │                        │
 │                         │                        │────────────────────────>│                        │
 │  [Loading indicator     │                        │  Compare CV vs JD       │                        │
 │   "Calculating fit..."] │                        │  Weight categories      │                        │
 │<────────────────────────│                        │  Generate breakdown     │                        │
 │                         │                        │<────────────────────────│                        │
 │                         │                        │                         │  INSERT match_score    │
 │                         │                        │                         │───────────────────────>│
 │                         │<───────────────────────│                         │                        │
 │                         │                        │                         │                        │
 │  Display score card     │                        │                         │                        │
 │  with breakdown         │                        │                         │                        │
 │<────────────────────────│                        │                         │                        │
 │                         │                        │                         │                        │
 │  [If score >= 50%]      │                        │                         │                        │
 │  Show "Start Interview" │                        │                         │                        │
 │  button                 │                        │                         │                        │
 │<────────────────────────│                        │                         │                        │
```

### 3.2 Adaptive Interview Flow

```
User                    Frontend                   API                    Services                  Database
 │                         │                        │                         │                        │
 │  Clicks "Start          │                        │                         │                        │
 │  Interview"             │                        │                         │                        │
 │────────────────────────>│                        │                         │                        │
 │                         │  POST /api/interview   │                         │                        │
 │                         │       /start           │                         │                        │
 │                         │───────────────────────>│                         │                        │
 │                         │                        │                         │                        │
 │                         │                        │    Question Generator   │                        │
 │                         │                        │────────────────────────>│                        │
 │  [Loading: "Preparing   │                        │                         │                        │
 │   your interview..."]   │                        │  1. Analyse competency  │                        │
 │<────────────────────────│                        │     areas from JD       │                        │
 │                         │                        │                         │                        │
 │                         │                        │  2. Generate question   │                        │
 │                         │                        │     plan (topics +      │                        │
 │                         │                        │     initial questions)  │                        │
 │                         │                        │                         │                        │
 │                         │                        │  3. Create first        │                        │
 │                         │                        │     question with       │                        │
 │                         │                        │     CV context          │                        │
 │                         │                        │<────────────────────────│                        │
 │                         │                        │                         │                        │
 │                         │                        │      TTS Engine         │                        │
 │                         │                        │────────────────────────>│                        │
 │                         │                        │  Convert Q1 to audio    │                        │
 │                         │                        │<────────────────────────│                        │
 │                         │                        │                         │  Save audio file       │
 │                         │                        │                         │  INSERT interview      │
 │                         │                        │                         │  INSERT question       │
 │                         │                        │                         │───────────────────────>│
 │                         │<───────────────────────│                         │                        │
 │                         │  { interviewId,        │                         │                        │
 │                         │    question: {         │                         │                        │
 │                         │      id, text,         │                         │                        │
 │                         │      audioUrl,         │                         │                        │
 │                         │      competency        │                         │                        │
 │                         │    },                  │                         │                        │
 │                         │    progress: {         │                         │                        │
 │                         │      current: 1,       │                         │                        │
 │                         │      estimatedTotal    │                         │                        │
 │                         │    }                   │                         │                        │
 │                         │  }                     │                         │                        │
 │                         │                        │                         │                        │
 │  Audio plays question   │                        │                         │                        │
 │<────────────────────────│                        │                         │                        │
 │                         │                        │                         │                        │
 │  [User toggles to       │                        │                         │                        │
 │   voice mode and        │                        │                         │                        │
 │   speaks answer]        │                        │                         │                        │
 │                         │                        │                         │                        │
 │  Records audio          │                        │                         │                        │
 │────────────────────────>│                        │                         │                        │
 │                         │                        │                         │                        │
 │  Clicks "Submit"        │                        │                         │                        │
 │────────────────────────>│                        │                         │                        │
 │                         │  POST /api/interview   │                         │                        │
 │                         │       /answer          │                         │                        │
 │                         │  [audio blob or text,  │                         │                        │
 │                         │   questionId]          │                         │                        │
 │                         │───────────────────────>│                         │                        │
 │                         │                        │                         │                        │
 │                         │                        │  [If audio submitted]   │                        │
 │                         │                        │      STT Engine         │                        │
 │  [Loading: "Processing  │                        │────────────────────────>│                        │
 │   your response..."]    │                        │  Transcribe audio       │                        │
 │<────────────────────────│                        │<────────────────────────│                        │
 │                         │                        │                         │                        │
 │                         │                        │   Response Evaluator    │                        │
 │                         │                        │────────────────────────>│                        │
 │                         │                        │                         │                        │
 │                         │                        │  Evaluate answer:       │                        │
 │                         │                        │  - Relevance (1-5)      │                        │
 │                         │                        │  - Depth (1-5)          │                        │
 │                         │                        │  - Accuracy (1-5)       │                        │
 │                         │                        │  - Examples (1-5)       │                        │
 │                         │                        │  → Overall score        │                        │
 │                         │                        │<────────────────────────│                        │
 │                         │                        │                         │                        │
 │                         │                        │                         │  INSERT answer         │
 │                         │                        │                         │───────────────────────>│
 │                         │                        │                         │                        │
 │                         │                        │                         │                        │
 │                         │                        │  ┌──────────────────────────────────────────┐   │
 │                         │                        │  │     ADAPTIVE DECISION LOGIC              │   │
 │                         │                        │  │                                          │   │
 │                         │                        │  │  If score <= 2 AND depth < maxDepth:     │   │
 │                         │                        │  │    → Generate clarifying follow-up       │   │
 │                         │                        │  │    → "Could you elaborate on..."         │   │
 │                         │                        │  │                                          │   │
 │                         │                        │  │  If score == 3 AND depth < maxDepth:     │   │
 │                         │                        │  │    → Generate probing follow-up          │   │
 │                         │                        │  │    → "How would you handle..."           │   │
 │                         │                        │  │                                          │   │
 │                         │                        │  │  If score >= 4 OR depth >= maxDepth:     │   │
 │                         │                        │  │    → Move to next competency area        │   │
 │                         │                        │  │    → Generate fresh question             │   │
 │                         │                        │  │                                          │   │
 │                         │                        │  │  If all competencies covered:            │   │
 │                         │                        │  │    → End interview                       │   │
 │                         │                        │  │    → Trigger summary generation          │   │
 │                         │                        │  └──────────────────────────────────────────┘   │
 │                         │                        │                         │                        │
 │                         │                        │                         │                        │
 │                         │                        │  [Decision: Follow-up needed]                   │
 │                         │                        │                         │                        │
 │                         │                        │   Question Generator    │                        │
 │                         │                        │────────────────────────>│                        │
 │                         │                        │  Generate follow-up     │                        │
 │                         │                        │  with context:          │                        │
 │                         │                        │  - Original question    │                        │
 │                         │                        │  - User's answer        │                        │
 │                         │                        │  - Evaluation feedback  │                        │
 │                         │                        │  - CV context           │                        │
 │                         │                        │<────────────────────────│                        │
 │                         │                        │                         │                        │
 │                         │                        │      TTS Engine         │                        │
 │                         │                        │────────────────────────>│                        │
 │                         │                        │<────────────────────────│                        │
 │                         │                        │                         │  INSERT question       │
 │                         │                        │                         │  (with parent_id)      │
 │                         │                        │                         │───────────────────────>│
 │                         │<───────────────────────│                         │                        │
 │                         │  { question: {...},    │                         │                        │
 │                         │    isFollowUp: true,   │                         │                        │
 │                         │    depth: 1,           │                         │                        │
 │                         │    progress: {...}     │                         │                        │
 │                         │  }                     │                         │                        │
 │                         │                        │                         │                        │
 │  Audio plays follow-up  │                        │                         │                        │
 │<────────────────────────│                        │                         │                        │
 │                         │                        │                         │                        │
 │        [... cycle continues until interview complete ...]                  │                        │
 │                         │                        │                         │                        │
```

### 3.3 Interview Completion and Summary Generation

```
User                    Frontend                   API                    Services                  Database
 │                         │                        │                         │                        │
 │  [Final answer          │                        │                         │                        │
 │   submitted, all        │                        │                         │                        │
 │   competencies          │                        │                         │                        │
 │   covered]              │                        │                         │                        │
 │                         │                        │                         │                        │
 │                         │<───────────────────────│  { status: "complete",  │                        │
 │                         │                        │    generating: true }   │                        │
 │                         │                        │                         │                        │
 │  [Loading: "Generating  │                        │                         │                        │
 │   your assessment...    │                        │                         │                        │
 │   This may take a       │                        │                         │                        │
 │   minute."]             │                        │                         │                        │
 │<────────────────────────│                        │                         │                        │
 │                         │                        │                         │                        │
 │                         │                        │   Summary Generator     │                        │
 │                         │                        │────────────────────────>│                        │
 │                         │                        │                         │                        │
 │                         │                        │  Input to LLM:          │                        │
 │                         │                        │  - Full CV data         │                        │
 │                         │                        │  - Full JD data         │                        │
 │                         │                        │  - All Q&A pairs        │                        │
 │                         │                        │  - Per-answer scores    │                        │
 │                         │                        │  - Competency coverage  │                        │
 │                         │                        │                         │                        │
 │                         │                        │  LLM generates:         │                        │
 │                         │                        │  - Overall score (0-100)│                        │
 │                         │                        │  - Per-competency       │                        │
 │                         │                        │    breakdown            │                        │
 │                         │                        │  - Strengths list       │                        │
 │                         │                        │  - Areas for            │                        │
 │                         │                        │    improvement          │                        │
 │                         │                        │  - Specific             │                        │
 │                         │                        │    recommendations      │                        │
 │                         │                        │  - Ready/Not Ready      │                        │
 │                         │                        │    verdict with         │                        │
 │                         │                        │    reasoning            │                        │
 │                         │                        │<────────────────────────│                        │
 │                         │                        │                         │                        │
 │                         │                        │                         │  INSERT summary        │
 │                         │                        │                         │───────────────────────>│
 │                         │                        │                         │  UPDATE interview      │
 │                         │                        │                         │  (status=complete)     │
 │                         │                        │                         │───────────────────────>│
 │                         │<───────────────────────│                         │                        │
 │                         │                        │                         │                        │
 │  Display results        │                        │                         │                        │
 │  dashboard with:        │                        │                         │                        │
 │  - Overall score        │                        │                         │                        │
 │  - Verdict badge        │                        │                         │                        │
 │  - Competency chart     │                        │                         │                        │
 │  - Strengths section    │                        │                         │                        │
 │  - Improvements section │                        │                         │                        │
 │  - Detailed Q&A review  │                        │                         │                        │
 │<────────────────────────│                        │                         │                        │
 │                         │                        │                         │                        │
 │                         │  [24 hours later...]   │                         │                        │
 │                         │                        │                         │                        │
 │                         │                        │    Cleanup Scheduler    │                        │
 │                         │                        │────────────────────────>│                        │
 │                         │                        │  SELECT * FROM sessions │                        │
 │                         │                        │  WHERE expires_at < NOW │                        │
 │                         │                        │<────────────────────────│                        │
 │                         │                        │                         │  DELETE cascade        │
 │                         │                        │                         │───────────────────────>│
 │                         │                        │  Delete associated      │                        │
 │                         │                        │  files from disk        │                        │
 │                         │                        │                         │                        │
```

---

## 4. Database Schema

### 4.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE SCHEMA                                     │
│                                                                                  │
│  ┌─────────────────────┐                                                        │
│  │      sessions       │                                                        │
│  ├─────────────────────┤         ┌─────────────────────┐                        │
│  │ id (PK)             │         │        cvs          │                        │
│  │ uuid (UNIQUE)       │────────<│ ├─────────────────────┤                        │
│  │ created_at          │         │ id (PK)             │                        │
│  │ expires_at          │         │ session_id (FK)     │                        │
│  │ status              │         │ file_path           │                        │
│  │ client_fingerprint  │         │ raw_text            │                        │
│  └─────────────────────┘         │ parsed_data (JSONB) │                        │
│           │                      │ created_at          │                        │
│           │                      └─────────────────────┘                        │
│           │                                                                      │
│           │              ┌─────────────────────────┐                             │
│           │              │    job_descriptions     │                             │
│           └─────────────<│ ├─────────────────────────┤                             │
│           │              │ id (PK)                 │                             │
│           │              │ session_id (FK)         │                             │
│           │              │ raw_text                │                             │
│           │              │ parsed_data (JSONB)     │                             │
│           │              │ created_at              │                             │
│           │              └─────────────────────────┘                             │
│           │                                                                      │
│           │              ┌─────────────────────────┐                             │
│           │              │     match_scores        │                             │
│           └─────────────<│ ├─────────────────────────┤                             │
│           │              │ id (PK)                 │                             │
│           │              │ session_id (FK)         │                             │
│           │              │ overall_score           │                             │
│           │              │ breakdown (JSONB)       │                             │
│           │              │ created_at              │                             │
│           │              └─────────────────────────┘                             │
│           │                                                                      │
│           │              ┌─────────────────────────┐                             │
│           │              │      interviews         │                             │
│           └─────────────<│ ├─────────────────────────┤                             │
│                          │ id (PK)                 │                             │
│                          │ session_id (FK)         │                             │
│                          │ status                  │──┐                          │
│                          │ question_plan (JSONB)   │  │                          │
│                          │ competencies_covered    │  │                          │
│                          │ started_at              │  │                          │
│                          │ completed_at            │  │  ┌─────────────────────┐ │
│                          └─────────────────────────┘  │  │     questions       │ │
│                                     │                 │  ├─────────────────────┤ │
│                                     │                 │  │ id (PK)             │ │
│                                     └────────────────────>│ interview_id (FK)   │ │
│                                                       │  │ parent_id (FK,self) │ │
│                                                       │  │ sequence_num        │ │
│                                                       │  │ competency          │ │
│                                                       │  │ question_text       │ │
│                                                       │  │ audio_path          │ │
│                                                       │  │ depth_level         │ │
│                                                       │  │ created_at          │ │
│                                                       │  └─────────────────────┘ │
│                                                       │            │             │
│                                                       │            │             │
│                                                       │            ▼             │
│                                                       │  ┌─────────────────────┐ │
│                                                       │  │      answers        │ │
│                                                       │  ├─────────────────────┤ │
│                                                       │  │ id (PK)             │ │
│                                                       │  │ question_id (FK)    │ │
│                                                       │  │ answer_text         │ │
│                                                       │  │ audio_path          │ │
│                                                       │  │ transcription       │ │
│                                                       │  │ response_time_ms    │ │
│                                                       │  │ evaluation (JSONB)  │ │
│                                                       │  │ quality_score       │ │
│                                                       │  │ created_at          │ │
│                                                       │  └─────────────────────┘ │
│                                                       │                          │
│                          ┌─────────────────────────┐  │                          │
│                          │      summaries          │  │                          │
│                          ├─────────────────────────┤  │                          │
│                          │ id (PK)                 │  │                          │
│                          │ interview_id (FK)       │<─┘                          │
│                          │ overall_score           │                             │
│                          │ competency_scores(JSONB)│                             │
│                          │ strengths (JSONB)       │                             │
│                          │ improvements (JSONB)    │                             │
│                          │ recommendations (JSONB) │                             │
│                          │ verdict                 │                             │
│                          │ verdict_reasoning       │                             │
│                          │ created_at              │                             │
│                          └─────────────────────────┘                             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Table Specifications

**sessions** serves as the root entity for all user data. The `uuid` field is the only identifier exposed to the frontend; internal `id` is used for foreign keys. The `status` field tracks the session lifecycle: `created`, `cv_uploaded`, `jd_submitted`, `scored`, `interviewing`, `completed`, `expired`. The `client_fingerprint` is an optional hash that can help detect if the same browser returns (useful for analytics, not identification).

**cvs** stores both the raw extracted text and the structured parsed data. The JSONB `parsed_data` field contains the schema:
```
{
  "personal": { "name": "...", "email": "...", "phone": "..." },
  "skills": {
    "technical": ["TypeScript", "React", "Node.js", ...],
    "soft": ["Communication", "Leadership", ...]
  },
  "experience": [
    {
      "company": "...",
      "role": "...",
      "duration_months": 24,
      "technologies": ["..."],
      "achievements": ["..."]
    }
  ],
  "education": [...],
  "projects": [...],
  "inferred_seniority": "mid-senior",
  "total_years_experience": 7
}
```

**job_descriptions** follows a similar pattern with JSONB for structured data:
```
{
  "title": "Senior Full Stack Engineer",
  "company": "...",
  "requirements": {
    "must_have": ["React", "Node.js", "PostgreSQL"],
    "nice_to_have": ["Kubernetes", "GraphQL"],
    "experience_years": { "min": 5, "max": 8 }
  },
  "responsibilities": ["..."],
  "soft_skills": ["..."],
  "inferred_seniority": "senior",
  "competency_areas": [
    { "name": "Frontend", "weight": 0.3, "skills": ["React", "CSS", "..."] },
    { "name": "Backend", "weight": 0.35, "skills": ["Node.js", "APIs", "..."] },
    { "name": "DevOps", "weight": 0.15, "skills": ["Docker", "CI/CD", "..."] },
    { "name": "Soft Skills", "weight": 0.2, "skills": ["Communication", "..."] }
  ]
}
```

**questions** uses a self-referential `parent_id` to create follow-up chains. The `depth_level` indicates how deep in a follow-up chain the question is (0 for root questions, 1 for first follow-up, etc.). The `competency` field links to one of the competency areas from the JD, enabling coverage tracking.

**answers** stores both text and audio responses. The `evaluation` JSONB contains detailed scoring:
```
{
  "relevance": 4,
  "depth": 3,
  "accuracy": 4,
  "examples": 2,
  "communication": 4,
  "reasoning": "Answer addressed the question but lacked concrete examples..."
}
```

**summaries** contains the comprehensive final assessment. The `verdict` is an enum: `ready`, `needs_preparation`, `not_ready`. All arrays in JSONB fields are ordered by importance/relevance.

### 4.3 Indexing Strategy

Primary indexes exist on all primary keys automatically. Additional indexes should be created on `sessions.uuid` (for fast lookup by frontend identifier), `sessions.expires_at` (for cleanup queries), `questions.interview_id` with `sequence_num` (for ordered retrieval), and `questions.parent_id` (for follow-up chain traversal). The JSONB fields should have GIN indexes if you need to query within them, but for this use case, you'll typically load the entire record.

---

## 5. AI Services Architecture

### 5.1 Local LLM Configuration with Ollama

The platform uses Ollama as the unified interface for local LLM inference. This provides a consistent API regardless of which model family you choose, simplifies model management, and enables easy model switching based on task requirements.

**Recommended Model Strategy:**

For CV parsing, JD parsing, and match scoring, a capable mid-size model works well. Models like `llama3.1:8b-instruct-q8_0` or `qwen2.5:14b-instruct-q6_K` offer good quality with reasonable inference speed. These tasks are less latency-sensitive since they happen once per session.

For question generation and response evaluation, you'll want a more capable model to ensure high-quality, contextually relevant questions and accurate evaluations. Consider `llama3.1:70b-instruct-q4_K_M` or `qwen2.5:72b-instruct-q4_K_M`. On your Mac mini M4 Pro with 64GB RAM, you can run the 70B class models with acceptable speed for interactive use.

For summary generation, use the same high-capability model as question generation since the final assessment needs to synthesise a lot of information intelligently.

**Ollama Service Configuration:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    OLLAMA CONFIGURATION                         │
│                                                                 │
│  Models to Pre-pull:                                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  llama3.1:8b-instruct-q8_0    (Light tasks, ~8GB VRAM)    │ │
│  │  qwen2.5:72b-instruct-q4_K_M  (Heavy tasks, ~40GB RAM)    │ │
│  │  OR                                                        │ │
│  │  llama3.1:70b-instruct-q4_K_M (Heavy tasks, ~40GB RAM)    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Environment:                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  OLLAMA_HOST=127.0.0.1:11434                              │ │
│  │  OLLAMA_NUM_PARALLEL=1  (single user, sequential)         │ │
│  │  OLLAMA_MAX_LOADED_MODELS=2                               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  API Endpoints Used:                                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  POST /api/generate  - For simple completions             │ │
│  │  POST /api/chat      - For conversational context         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 LLM Orchestrator Design

The LLM Orchestrator is a service layer that abstracts Ollama interactions and handles common concerns like prompt templates, retry logic, and response parsing.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LLM ORCHESTRATOR                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        PROMPT TEMPLATE REGISTRY                        │ │
│  │                                                                        │ │
│  │  cv_parser_prompt:                                                     │ │
│  │    system: "You are an expert CV analyst..."                          │ │
│  │    user_template: "Extract structured data from: {{cv_text}}"         │ │
│  │    output_schema: CVParsedData                                        │ │
│  │    model: "llama3.1:8b-instruct-q8_0"                                 │ │
│  │                                                                        │ │
│  │  jd_parser_prompt:                                                     │ │
│  │    system: "You are a job requirements analyst..."                    │ │
│  │    user_template: "Extract requirements from: {{jd_text}}"            │ │
│  │    output_schema: JDParsedData                                        │ │
│  │    model: "llama3.1:8b-instruct-q8_0"                                 │ │
│  │                                                                        │ │
│  │  question_generator_prompt:                                            │ │
│  │    system: "You are a technical interviewer..."                       │ │
│  │    user_template: "Generate question for {{competency}}..."           │ │
│  │    output_schema: GeneratedQuestion                                   │ │
│  │    model: "qwen2.5:72b-instruct-q4_K_M"                               │ │
│  │                                                                        │ │
│  │  followup_generator_prompt:                                            │ │
│  │    system: "You are conducting a follow-up..."                        │ │
│  │    user_template: "Given Q: {{question}}, A: {{answer}}..."           │ │
│  │    output_schema: GeneratedQuestion                                   │ │
│  │    model: "qwen2.5:72b-instruct-q4_K_M"                               │ │
│  │                                                                        │ │
│  │  response_evaluator_prompt:                                            │ │
│  │    system: "You are evaluating interview responses..."                │ │
│  │    user_template: "Evaluate: Q: {{question}}, A: {{answer}}"          │ │
│  │    output_schema: ResponseEvaluation                                  │ │
│  │    model: "qwen2.5:72b-instruct-q4_K_M"                               │ │
│  │                                                                        │ │
│  │  summary_generator_prompt:                                             │ │
│  │    system: "You are preparing a candidate assessment..."              │ │
│  │    user_template: "Assess based on: {{full_interview_data}}"          │ │
│  │    output_schema: InterviewSummary                                    │ │
│  │    model: "qwen2.5:72b-instruct-q4_K_M"                               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        REQUEST PIPELINE                                │ │
│  │                                                                        │ │
│  │  1. Template Selection    → Pick prompt based on task type            │ │
│  │  2. Variable Injection    → Fill in {{placeholders}}                  │ │
│  │  3. Request Formatting    → Build Ollama API request                  │ │
│  │  4. Inference Call        → POST to Ollama with timeout               │ │
│  │  5. Response Parsing      → Extract JSON from response                │ │
│  │  6. Schema Validation     → Validate against output_schema            │ │
│  │  7. Retry Logic           → If parsing fails, retry up to 3x          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        ERROR HANDLING                                  │ │
│  │                                                                        │ │
│  │  Ollama Unreachable  → Surface to user, suggest checking service      │ │
│  │  Timeout (5 min)     → Return partial if possible, else error         │ │
│  │  Parse Failure       → Retry with simplified prompt                   │ │
│  │  Schema Mismatch     → Log warning, use partial data                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Speech-to-Text with Whisper

For STT, the recommended approach is to run `faster-whisper` as a local HTTP service. This provides better performance than the original Whisper implementation while maintaining accuracy.

```
┌─────────────────────────────────────────────────────────────────┐
│                    STT SERVICE (WHISPER)                        │
│                                                                 │
│  Deployment: faster-whisper-server or whisper.cpp HTTP wrapper  │
│                                                                 │
│  Model: whisper-large-v3  (best accuracy)                       │
│         whisper-medium    (faster, still good)                  │
│                                                                 │
│  API Contract:                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  POST /transcribe                                         │ │
│  │  Content-Type: multipart/form-data                        │ │
│  │  Body: { audio: <binary>, language: "en" }                │ │
│  │                                                            │ │
│  │  Response: {                                               │ │
│  │    "text": "Full transcription...",                       │ │
│  │    "segments": [                                          │ │
│  │      { "start": 0.0, "end": 2.5, "text": "...",           │ │
│  │        "confidence": 0.95 }                               │ │
│  │    ],                                                     │ │
│  │    "language": "en",                                      │ │
│  │    "duration": 45.2                                       │ │
│  │  }                                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Processing Pipeline:                                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  1. Receive audio blob from frontend (webm/opus or wav)   │ │
│  │  2. Convert to WAV 16kHz mono if needed (ffmpeg)          │ │
│  │  3. Send to Whisper service                               │ │
│  │  4. Store transcription in answers table                  │ │
│  │  5. Pass text to Response Evaluator                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Hardware Notes:                                                │
│  - Runs efficiently on CPU (M4 Pro handles large-v3 well)      │
│  - ~5-10 seconds to transcribe 1 minute of audio               │
│  - Can run alongside Ollama without conflict                   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 Text-to-Speech Configuration

For TTS, you have two solid local options: Coqui XTTS (higher quality, slower) or Piper (faster, slightly more robotic). Given that interview questions are generated ahead of playback and can be cached, XTTS is the better choice for natural-sounding questions.

```
┌─────────────────────────────────────────────────────────────────┐
│                    TTS SERVICE (COQUI XTTS)                     │
│                                                                 │
│  Deployment: coqui-ai TTS server or custom FastAPI wrapper      │
│                                                                 │
│  Voice Configuration:                                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Option A: Use built-in voices                            │ │
│  │    - Professional, neutral interviewer voice              │ │
│  │                                                            │ │
│  │  Option B: Clone a voice (XTTS feature)                   │ │
│  │    - Record 30 seconds of reference audio                 │ │
│  │    - Consistent voice across all questions                │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  API Contract:                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  POST /synthesize                                         │ │
│  │  Content-Type: application/json                           │ │
│  │  Body: {                                                  │ │
│  │    "text": "Tell me about your experience with React.",   │ │
│  │    "voice_id": "interviewer_v1",                          │ │
│  │    "speed": 1.0                                           │ │
│  │  }                                                        │ │
│  │                                                            │ │
│  │  Response: audio/wav binary stream                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Caching Strategy:                                              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  1. Generate audio immediately after question creation    │ │
│  │  2. Save to /data/audio/{question_id}.wav                 │ │
│  │  3. Store path in questions.audio_path                    │ │
│  │  4. Serve via static file route or signed URL             │ │
│  │  5. Delete with session cleanup                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Alternative (Faster): Piper TTS                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  - Runs entirely on CPU, extremely fast                   │ │
│  │  - ~0.1 seconds per sentence                              │ │
│  │  - Slightly less natural than XTTS                        │ │
│  │  - Good fallback if XTTS is too slow                      │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Interview Logic Engine

### 6.1 Question Generation Strategy

The Interview Logic Engine is the brain of the adaptive interview system. It ensures comprehensive coverage of job requirements while responding intelligently to candidate performance.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INTERVIEW LOGIC ENGINE                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    COMPETENCY EXTRACTION                               │ │
│  │                                                                        │ │
│  │  Input: Parsed JD with competency_areas                               │ │
│  │                                                                        │ │
│  │  Example for "Senior Full Stack Engineer":                            │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Competency          │ Weight │ Skills              │ Questions │ │ │
│  │  │  ────────────────────┼────────┼─────────────────────┼────────── │ │ │
│  │  │  Frontend            │ 30%    │ React, TypeScript,  │ 2-3       │ │ │
│  │  │                      │        │ State Management    │           │ │ │
│  │  │  Backend             │ 35%    │ Node.js, APIs,      │ 3-4       │ │ │
│  │  │                      │        │ Databases           │           │ │ │
│  │  │  DevOps/Cloud        │ 15%    │ Docker, CI/CD, AWS  │ 1-2       │ │ │
│  │  │  System Design       │ 10%    │ Architecture,       │ 1         │ │ │
│  │  │                      │        │ Scalability         │           │ │ │
│  │  │  Soft Skills         │ 10%    │ Communication,      │ 1         │ │ │
│  │  │                      │        │ Collaboration       │           │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  Question allocation is proportional to weight, with minimum 1        │ │
│  │  question per competency area.                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    QUESTION PLAN GENERATION                            │ │
│  │                                                                        │ │
│  │  Phase 1: Initial Plan Creation (at interview start)                  │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  For each competency:                                            │ │ │
│  │  │    1. Consider candidate's CV strengths in this area             │ │ │
│  │  │    2. Consider job's specific requirements                       │ │ │
│  │  │    3. Generate opening question that:                            │ │ │
│  │  │       - References CV if relevant ("I see you used X at Y...")   │ │ │
│  │  │       - Targets core competency skill                            │ │ │
│  │  │       - Is open-ended enough to assess depth                     │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  Phase 2: Dynamic Adjustment (during interview)                       │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  After each answer, the plan may adapt:                          │ │ │
│  │  │    - Strong answer → May skip planned follow-up, move on         │ │ │
│  │  │    - Weak answer → Add follow-up, potentially add more Qs        │ │ │
│  │  │    - Unexpected skill revealed → May add bonus question          │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    ADAPTIVE FOLLOW-UP LOGIC                            │ │
│  │                                                                        │ │
│  │  Decision Tree:                                                        │ │
│  │                                                                        │ │
│  │                    ┌─────────────────┐                                 │ │
│  │                    │ Evaluate Answer │                                 │ │
│  │                    │ Quality (1-5)   │                                 │ │
│  │                    └────────┬────────┘                                 │ │
│  │                             │                                          │ │
│  │           ┌─────────────────┼─────────────────┐                        │ │
│  │           │                 │                 │                        │ │
│  │           ▼                 ▼                 ▼                        │ │
│  │     ┌─────────┐       ┌─────────┐       ┌─────────┐                   │ │
│  │     │ Score   │       │ Score   │       │ Score   │                   │ │
│  │     │ 1-2     │       │   3     │       │  4-5    │                   │ │
│  │     │ (Weak)  │       │ (Okay)  │       │ (Strong)│                   │ │
│  │     └────┬────┘       └────┬────┘       └────┬────┘                   │ │
│  │          │                 │                 │                        │ │
│  │          ▼                 ▼                 ▼                        │ │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐               │ │
│  │  │ Check depth   │ │ Check depth   │ │ Move to next  │               │ │
│  │  │ < max (3)?    │ │ < max (3)?    │ │ competency    │               │ │
│  │  └───────┬───────┘ └───────┬───────┘ └───────────────┘               │ │
│  │          │                 │                                          │ │
│  │    Yes   │   No      Yes   │   No                                     │ │
│  │    ┌─────┴─────┐     ┌─────┴─────┐                                   │ │
│  │    ▼           ▼     ▼           ▼                                   │ │
│  │  Generate   Move   Generate   Move                                    │ │
│  │  CLARIFY    on     PROBE      on                                      │ │
│  │  follow-up        follow-up                                           │ │
│  │                                                                        │ │
│  │  Follow-up Types:                                                      │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  CLARIFY: "Could you give me a specific example of..."           │ │ │
│  │  │           "What do you mean by..."                               │ │ │
│  │  │           "Walk me through the steps you took..."                │ │ │
│  │  │                                                                  │ │ │
│  │  │  PROBE:   "How would you handle it differently now?"             │ │ │
│  │  │           "What were the trade-offs you considered?"             │ │ │
│  │  │           "How did you measure success?"                         │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    COVERAGE TRACKING                                   │ │
│  │                                                                        │ │
│  │  State maintained throughout interview:                               │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  {                                                               │ │ │
│  │  │    "competencies": {                                             │ │ │
│  │  │      "frontend": {                                               │ │ │
│  │  │        "status": "completed",                                    │ │ │
│  │  │        "questions_asked": 3,                                     │ │ │
│  │  │        "avg_score": 4.2                                          │ │ │
│  │  │      },                                                          │ │ │
│  │  │      "backend": {                                                │ │ │
│  │  │        "status": "in_progress",                                  │ │ │
│  │  │        "questions_asked": 2,                                     │ │ │
│  │  │        "current_depth": 1,                                       │ │ │
│  │  │        "avg_score": 3.0                                          │ │ │
│  │  │      },                                                          │ │ │
│  │  │      "devops": {                                                 │ │ │
│  │  │        "status": "pending",                                      │ │ │
│  │  │        "questions_asked": 0                                      │ │ │
│  │  │      }                                                           │ │ │
│  │  │    },                                                            │ │ │
│  │  │    "total_questions": 5,                                         │ │ │
│  │  │    "estimated_remaining": 4                                      │ │ │
│  │  │  }                                                               │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  Interview ends when:                                                  │ │
│  │    - All competencies reach "completed" status                        │ │
│  │    - OR maximum questions reached (configurable, default 15)          │ │
│  │    - OR maximum time elapsed (configurable, default 45 min)           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Question Quality Guidelines

Questions generated by the system should follow these principles to ensure they assess real competence and feel like genuine interviews rather than trivia quizzes.

**Contextual Grounding:** Questions should reference the candidate's CV where possible. Instead of "Tell me about your React experience," the system might generate "You mentioned building a dashboard at your previous role. Walk me through your approach to state management in that project."

**Open-Ended by Default:** Initial questions should be broad enough to let candidates demonstrate depth. Follow-ups then narrow down based on the response.

**Behavioural Focus:** Questions should often use the STAR format (Situation, Task, Action, Result) prompts, especially for soft skills. "Tell me about a time when..." questions reveal more than hypotheticals.

**Technical Depth Scaling:** For technical competencies, questions should match the role's seniority level. A mid-level role might ask about implementation details; a senior role asks about architectural decisions and trade-offs.

**Natural Transitions:** When moving between competencies, the system generates transitional phrasing: "Great, let's shift gears and talk about..." rather than abrupt topic changes.

---

## 7. User Interface Flow

### 7.1 Screen-by-Screen Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE FLOW                                  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    SCREEN 1: LANDING / UPLOAD                          │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │                                                                  │ │ │
│  │  │     🎯 AI Interview Prep                                        │ │ │
│  │  │                                                                  │ │ │
│  │  │     Upload your CV and target job description to receive        │ │ │
│  │  │     a compatibility score and practice with an AI interviewer.  │ │ │
│  │  │                                                                  │ │ │
│  │  │     ┌────────────────────────────────────────────────────────┐  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │     📄 Drop your CV here                              │  │ │ │
│  │  │     │        PDF or TXT (max 5MB)                           │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │     [Browse Files]                                    │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     └────────────────────────────────────────────────────────┘  │ │ │
│  │  │                                                                  │ │ │
│  │  │     ┌────────────────────────────────────────────────────────┐  │ │ │
│  │  │     │ Paste the job description here...                      │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     └────────────────────────────────────────────────────────┘  │ │ │
│  │  │                                                                  │ │ │
│  │  │     [Analyse My Fit →]                                          │ │ │
│  │  │                                                                  │ │ │
│  │  │     ────────────────────────────────────────────────────────    │ │ │
│  │  │     🔒 Your data is processed locally and auto-deleted          │ │ │
│  │  │        after 24 hours. No account required.                     │ │ │
│  │  │                                                                  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  States:                                                               │ │
│  │  - Initial: Empty form                                                │ │
│  │  - CV Selected: File name shown, validation passed                    │ │
│  │  - Processing: "Analysing your documents..." with progress            │ │
│  │  - Error: Inline validation messages                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    SCREEN 2: SCORE RESULTS                             │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │                                                                  │ │ │
│  │  │     Your Match Score                                            │ │ │
│  │  │                                                                  │ │ │
│  │  │              ╭─────────────╮                                    │ │ │
│  │  │              │             │                                    │ │ │
│  │  │              │     72%     │  ← Circular progress indicator     │ │ │
│  │  │              │             │                                    │ │ │
│  │  │              ╰─────────────╯                                    │ │ │
│  │  │                                                                  │ │ │
│  │  │     "Strong match - you meet most requirements"                 │ │ │
│  │  │                                                                  │ │ │
│  │  │     ── Breakdown ──────────────────────────────────────────     │ │ │
│  │  │                                                                  │ │ │
│  │  │     Technical Skills        ████████████░░░░  78%               │ │ │
│  │  │     Experience Level        █████████████░░░  85%               │ │ │
│  │  │     Required Technologies   ██████████░░░░░░  65%               │ │ │
│  │  │     Soft Skills             ███████████████░  95%               │ │ │
│  │  │                                                                  │ │ │
│  │  │     ── Strengths ──────────────────────────────────────────     │ │ │
│  │  │     ✓ Strong React and Node.js experience                       │ │ │
│  │  │     ✓ Leadership experience matches senior expectations         │ │ │
│  │  │     ✓ Relevant project portfolio                                │ │ │
│  │  │                                                                  │ │ │
│  │  │     ── Gaps to Address ────────────────────────────────────     │ │ │
│  │  │     ⚠ Limited Kubernetes exposure (job requires)                │ │ │
│  │  │     ⚠ No GraphQL mentioned (nice-to-have)                       │ │ │
│  │  │                                                                  │ │ │
│  │  │     [Start Mock Interview →]      [Upload Different CV]         │ │ │
│  │  │                                                                  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  Score < 50%:                                                          │ │
│  │  - Interview button disabled or shows "Review Gaps First"             │ │
│  │  - Shows encouraging message: "Consider addressing these gaps..."     │ │
│  │  - Still allows starting interview with warning                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    SCREEN 3: INTERVIEW ROOM                            │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │                                                                  │ │ │
│  │  │     Mock Interview                                              │ │ │
│  │  │     Senior Full Stack Engineer                                  │ │ │
│  │  │                                                                  │ │ │
│  │  │     Progress: ████████░░░░░░░░ Question 3 of ~8                  │ │ │
│  │  │     Topic: Backend Development                                  │ │ │
│  │  │                                                                  │ │ │
│  │  │     ┌────────────────────────────────────────────────────────┐  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │  🎤 INTERVIEWER                                       │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │  "I see you built a real-time notification system     │  │ │ │
│  │  │     │   at Mentorloop. What were the main technical         │  │ │ │
│  │  │     │   challenges you faced with message delivery          │  │ │ │
│  │  │     │   guarantees?"                                        │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │  [▶ Play Audio]  [⟳ Replay]                           │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     └────────────────────────────────────────────────────────┘  │ │ │
│  │  │                                                                  │ │ │
│  │  │     ┌────────────────────────────────────────────────────────┐  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │  YOUR RESPONSE                                        │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │  ○ Type    ● Speak                                    │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │       ╭─────────────────╮                             │  │ │ │
│  │  │     │       │   🎙️  0:34      │  ← Recording indicator       │  │ │ │
│  │  │     │       │   Recording...  │                             │  │ │ │
│  │  │     │       ╰─────────────────╯                             │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │  [Stop & Submit]                                      │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     └────────────────────────────────────────────────────────┘  │ │ │
│  │  │                                                                  │ │ │
│  │  │     ────────────────────────────────────────────────────────    │ │ │
│  │  │     [End Interview Early]                                       │ │ │
│  │  │                                                                  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  States:                                                               │ │
│  │  - Question Playing: Audio plays automatically, controls shown        │ │
│  │  - Awaiting Response: User decides type/speak                         │ │
│  │  - Recording: Timer shown, waveform visualisation                     │ │
│  │  - Processing: "Analysing your response..." spinner                   │ │
│  │  - Follow-up Incoming: Brief pause, then next question loads          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    SCREEN 4: RESULTS DASHBOARD                         │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │                                                                  │ │ │
│  │  │     Interview Assessment                                        │ │ │
│  │  │                                                                  │ │ │
│  │  │     ┌────────────────────────────────────────────────────────┐  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │         Overall Readiness Score                       │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │                   76/100                               │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     │     ╭──────────────────────────────────────────────╮  │  │ │ │
│  │  │     │     │  ✓ RECOMMENDED FOR NEXT ROUND                │  │  │ │ │
│  │  │     │     │                                              │  │  │ │ │
│  │  │     │     │  Based on your responses, you demonstrate    │  │  │ │ │
│  │  │     │     │  strong technical fundamentals and would     │  │  │ │ │
│  │  │     │     │  likely progress past initial screening.     │  │  │ │ │
│  │  │     │     ╰──────────────────────────────────────────────╯  │  │ │ │
│  │  │     │                                                        │  │ │ │
│  │  │     └────────────────────────────────────────────────────────┘  │ │ │
│  │  │                                                                  │ │ │
│  │  │     ── Competency Breakdown ───────────────────────────────     │ │ │
│  │  │                                                                  │ │ │
│  │  │     Frontend         ████████████████░░░░  82%  Excellent       │ │ │
│  │  │     Backend          █████████████░░░░░░░  68%  Good            │ │ │
│  │  │     DevOps           ████████░░░░░░░░░░░░  45%  Needs Work      │ │ │
│  │  │     System Design    ██████████████░░░░░░  72%  Good            │ │ │
│  │  │     Communication    █████████████████░░░  88%  Excellent       │ │ │
│  │  │                                                                  │ │ │
│  │  │     ── Key Strengths ──────────────────────────────────────     │ │ │
│  │  │                                                                  │ │ │
│  │  │     • Clear articulation of complex technical concepts          │ │ │
│  │  │     • Strong React architecture understanding                   │ │ │
│  │  │     • Good use of concrete examples from experience             │ │ │
│  │  │                                                                  │ │ │
│  │  │     ── Areas for Improvement ──────────────────────────────     │ │ │
│  │  │                                                                  │ │ │
│  │  │     • Deepen Kubernetes/container orchestration knowledge       │ │ │
│  │  │     • Practice explaining database scaling decisions            │ │ │
│  │  │     • Prepare more specific metrics for project outcomes        │ │ │
│  │  │                                                                  │ │ │
│  │  │     ── Question-by-Question Review ────────────────────────     │ │ │
│  │  │     [Expand to see each Q&A with individual feedback]           │ │ │
│  │  │                                                                  │ │ │
│  │  │     ────────────────────────────────────────────────────────    │ │ │
│  │  │                                                                  │ │ │
│  │  │     [Start New Session]    [Download Report (PDF)]              │ │ │
│  │  │                                                                  │ │ │
│  │  │     ⚠️ This session expires in 22 hours. Save your report.      │ │ │
│  │  │                                                                  │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Loading State Strategy

Given that local LLM inference can take significant time (30 seconds to several minutes for complex operations), the UI must communicate progress effectively without frustrating users.

**Progressive Disclosure:** Show what's happening at each stage. "Parsing your CV..." → "Extracting skills and experience..." → "Comparing against job requirements..."

**Estimated Times:** Based on benchmarks, display approximate wait times. "This typically takes 30-60 seconds on most hardware."

**Graceful Degradation:** If an operation exceeds timeout thresholds, offer options: "This is taking longer than expected. You can wait, or try with a smaller model for faster results."

**Interruptibility:** Allow users to cancel long-running operations and return to the previous state.

---

## 8. Infrastructure and Deployment

### 8.1 Self-Hosted Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ARCHITECTURE                                   │
│                                                                              │
│  Target: Mac mini M4 Pro (64GB RAM) or similar capable machine              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    DOCKER COMPOSE TOPOLOGY                             │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │                     docker-compose.yml                          │  │ │
│  │  │                                                                 │  │ │
│  │  │  services:                                                      │  │ │
│  │  │                                                                 │  │ │
│  │  │    nextjs-app:                                                  │  │ │
│  │  │      - Main application                                         │  │ │
│  │  │      - Ports: 3000                                              │  │ │
│  │  │      - Depends: postgres, ollama, whisper, tts                  │  │ │
│  │  │                                                                 │  │ │
│  │  │    postgres:                                                    │  │ │
│  │  │      - Database                                                 │  │ │
│  │  │      - Ports: 5432 (internal)                                   │  │ │
│  │  │      - Volumes: pgdata                                          │  │ │
│  │  │                                                                 │  │ │
│  │  │    ollama:                                                      │  │ │
│  │  │      - LLM inference server                                     │  │ │
│  │  │      - Ports: 11434 (internal)                                  │  │ │
│  │  │      - Volumes: ollama-models                                   │  │ │
│  │  │      - GPU passthrough (if available)                           │  │ │
│  │  │                                                                 │  │ │
│  │  │    whisper:                                                     │  │ │
│  │  │      - STT service (faster-whisper)                             │  │ │
│  │  │      - Ports: 8080 (internal)                                   │  │ │
│  │  │      - Volumes: whisper-models                                  │  │ │
│  │  │                                                                 │  │ │
│  │  │    tts:                                                         │  │ │
│  │  │      - TTS service (Coqui or Piper)                             │  │ │
│  │  │      - Ports: 8081 (internal)                                   │  │ │
│  │  │      - Volumes: tts-models                                      │  │ │
│  │  │                                                                 │  │ │
│  │  │  volumes:                                                       │  │ │
│  │  │    pgdata:                                                      │  │ │
│  │  │    ollama-models:                                               │  │ │
│  │  │    whisper-models:                                              │  │ │
│  │  │    tts-models:                                                  │  │ │
│  │  │    uploads:                                                     │  │ │
│  │  │    audio:                                                       │  │ │
│  │  │                                                                 │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    RESOURCE ALLOCATION                                 │ │
│  │                                                                        │ │
│  │  Total Available: 64GB RAM, 14 CPU cores (M4 Pro)                     │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Service          │ RAM Allocation │ Notes                      │  │ │
│  │  │  ─────────────────┼────────────────┼─────────────────────────── │  │ │
│  │  │  Ollama (70B)     │ 40-45 GB       │ Primary consumer           │  │ │
│  │  │  Whisper Large    │ 3-4 GB         │ Loaded on demand           │  │ │
│  │  │  TTS (XTTS)       │ 2-3 GB         │ Persistent                 │  │ │
│  │  │  PostgreSQL       │ 1 GB           │ Minimal for this scale     │  │ │
│  │  │  Next.js          │ 500 MB         │ Node.js process            │  │ │
│  │  │  System/Buffer    │ 10+ GB         │ OS and headroom            │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  Note: With single-user design, services can share resources          │ │
│  │  sequentially rather than requiring simultaneous allocation.          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    DIRECTORY STRUCTURE                                 │ │
│  │                                                                        │ │
│  │  /app                                                                  │ │
│  │    /cv-interview-platform                                              │ │
│  │      /src                                                              │ │
│  │        /app                    ← Next.js app router                    │ │
│  │        /components             ← React components                      │ │
│  │        /lib                                                            │ │
│  │          /services             ← Business logic                        │ │
│  │          /ai                   ← LLM orchestration                     │ │
│  │          /db                   ← Sequelize models                      │ │
│  │        /prompts                ← LLM prompt templates                  │ │
│  │      /public                                                           │ │
│  │      /docker                   ← Dockerfiles for each service          │ │
│  │                                                                        │ │
│  │  /data                         ← Mounted volumes                       │ │
│  │    /uploads                    ← Uploaded CVs (cleaned after 24h)      │ │
│  │    /audio                      ← Generated audio (cleaned after 24h)   │ │
│  │    /postgres                   ← Database files                        │ │
│  │    /models                                                             │ │
│  │      /ollama                   ← LLM weights                           │ │
│  │      /whisper                  ← Whisper weights                       │ │
│  │      /tts                      ← TTS voices                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Cleanup Job Implementation

The cleanup mechanism runs as a scheduled job within the Next.js application using node-cron or as a separate lightweight process.

**Execution Frequency:** Hourly checks balance prompt cleanup against unnecessary database queries.

**Cleanup Logic:** Query sessions where `expires_at < NOW()`, cascade delete all related records (foreign key constraints handle this), iterate through associated file paths and delete from filesystem, log metrics for monitoring (sessions cleaned, files removed, space freed).

**Safety Measures:** Soft delete first (mark as `status = 'expired'`), then hard delete in a subsequent pass. This provides a brief recovery window if needed.

---

## 9. Security and Privacy Considerations

### 9.1 Data Handling Principles

Despite the ephemeral design, the system handles potentially sensitive documents and should follow privacy best practices.

**No Logging of Document Contents:** Application logs should never include CV text, JD text, or user responses. Log only metadata like session IDs, timestamps, and operation types.

**Filesystem Permissions:** Uploaded files and generated audio should be stored with restricted permissions (0600) and served through the application rather than directly via a static file server.

**No External Analytics:** For the open-source version, avoid third-party analytics that might transmit document fingerprints or behavioral data. If analytics are needed, implement them locally.

**Secure Session IDs:** While UUIDs are not secret, they should still be generated using cryptographically secure randomness to prevent guessing.

**Transport Security:** Even for local deployments, encourage HTTPS setup (Let's Encrypt or self-signed for local dev) to prevent eavesdropping on shared networks.

### 9.2 Open Core Considerations

For the future paid tier, consider what features would justify payment without undermining the open-source value proposition.

**Potential Premium Features:** Multiple concurrent sessions, custom voice cloning for the interviewer, integration with ATS systems, extended data retention with encryption, team/enterprise features (multiple users, shared job descriptions), advanced analytics and progress tracking over time, fine-tuned models for specific industries.

---

## 10. Future Extensibility Points

### 10.1 Architecture Flexibility

The modular design enables several future enhancements without major restructuring.

**Multi-language Support:** The TTS/STT services can be swapped for multilingual variants. The LLM prompts would need language-specific templates, but the overall flow remains identical.

**Video Integration:** Adding video recording/playback would involve adding a media server component and extending the answer storage to include video files. The interview logic remains unchanged.

**Real-time Feedback:** Currently, evaluation happens after each answer. The architecture could support streaming responses where the evaluator provides hints or encouragement during answers, though this increases complexity significantly.

**Custom Question Banks:** Organisations could upload their own question templates that the system uses as seeds for generation, combining structured interview practices with AI personalisation.

**Peer Comparison:** With user consent, anonymised aggregate data could show how a candidate's scores compare to others who interviewed for similar roles. This requires careful privacy consideration.

### 10.2 Model Evolution Path

As local LLMs improve, the system benefits automatically through Ollama model updates. The prompt templates may need adjustment for new model families, but the overall architecture remains stable. Consider testing new models against a benchmark set of CV/JD pairs to ensure quality doesn't regress.

---

## Appendix A: Prompt Template Examples

This section provides conceptual examples of the prompts used by each AI service. These would be refined through iteration.

**CV Parser Prompt (Conceptual):**
The system prompt establishes the parser as an expert HR analyst. The user prompt provides the raw CV text and requests a specific JSON schema as output. Key instructions include: infer seniority from job titles and responsibilities, extract both explicit and implicit skills, handle missing sections gracefully, and estimate experience durations when not explicitly stated.

**Question Generator Prompt (Conceptual):**
The system prompt establishes the generator as a senior technical interviewer for the specific role. Context includes the full parsed JD, the candidate's CV highlights, and the competency currently being assessed. The prompt instructs the model to create questions that are open-ended, reference the candidate's experience where possible, and assess both technical depth and problem-solving approach.

**Response Evaluator Prompt (Conceptual):**
The system prompt establishes the evaluator as an interview assessment expert. Input includes the original question, the candidate's answer, and the expected competencies being tested. The output schema includes numerical scores (1-5) for each dimension, a brief reasoning explanation, and a recommendation for whether a follow-up is needed.

---

## Appendix B: Performance Benchmarks (Expected)

Based on typical local LLM performance on Apple Silicon with 64GB RAM:

**CV/JD Parsing (8B model):** 15-30 seconds per document

**Match Scoring:** 10-20 seconds (simpler prompt, mostly comparison logic)

**Question Generation (70B model):** 30-60 seconds per question

**Response Evaluation (70B model):** 20-40 seconds per answer

**TTS Generation:** 5-10 seconds per question (cacheable)

**STT Transcription:** 5-15 seconds per minute of audio

**Summary Generation (70B model):** 60-120 seconds (complex synthesis)

**Total Interview Duration:** Expect 30-45 minutes for an 8-question interview, including user response time.

---

*This architecture document is intended as a comprehensive blueprint. Implementation details may evolve based on practical testing and user feedback. The core principles of local inference, ephemeral data, and genuine applicant value should guide all technical decisions.*
