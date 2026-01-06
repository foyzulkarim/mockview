// Core type definitions for MockView
// Based on the database schema and API contracts from architecture document

// Session status enum
export type SessionStatus =
  | 'created'
  | 'cv_uploaded'
  | 'jd_submitted'
  | 'scored'
  | 'interviewing'
  | 'completed'
  | 'expired';

// Interview status
export type InterviewStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

// Summary verdict types
export type Verdict = 'ready' | 'needs_preparation' | 'not_ready';

// Competency status during interview
export type CompetencyStatus = 'pending' | 'in_progress' | 'completed';

// Follow-up question types
export type FollowUpType = 'clarify' | 'probe';

// ============ Parsed Data Structures ============

// CV Parsed Data (stored in JSONB)
export interface ParsedCVData {
  personal: {
    name?: string;
    email?: string;
    phone?: string;
  };
  skills: {
    technical: string[];
    soft: string[];
  };
  experience: Array<{
    company: string;
    role: string;
    duration_months: number;
    technologies: string[];
    achievements: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    year?: number;
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
    url?: string;
  }>;
  inferred_seniority: 'junior' | 'mid' | 'mid-senior' | 'senior' | 'lead' | 'principal';
  total_years_experience: number;
}

// JD Parsed Data (stored in JSONB)
export interface ParsedJDData {
  title: string;
  company?: string;
  requirements: {
    must_have: string[];
    nice_to_have: string[];
    experience_years: {
      min: number;
      max: number;
    };
  };
  responsibilities: string[];
  soft_skills: string[];
  inferred_seniority: 'junior' | 'mid' | 'mid-senior' | 'senior' | 'lead' | 'principal';
  competency_areas: CompetencyArea[];
}

export interface CompetencyArea {
  name: string;
  weight: number; // 0-1, all weights should sum to 1
  skills: string[];
}

// ============ Match Score Structures ============

export interface MatchBreakdown {
  technical_skills: {
    score: number; // 0-100
    matched: string[];
    missing: string[];
  };
  experience_level: {
    score: number;
    cv_level: string;
    jd_level: string;
    assessment: string;
  };
  required_technologies: {
    score: number;
    matched: string[];
    missing: string[];
  };
  soft_skills: {
    score: number;
    matched: string[];
    assessment: string;
  };
  strengths: string[];
  gaps: string[];
}

// ============ Interview Structures ============

export interface QuestionPlan {
  competencies: Array<{
    name: string;
    weight: number;
    planned_questions: number;
    skills_to_cover: string[];
  }>;
  total_planned_questions: number;
  estimated_duration_minutes: number;
}

export interface InterviewState {
  competencies: Record<string, {
    status: CompetencyStatus;
    questions_asked: number;
    current_depth: number;
    avg_score: number;
  }>;
  total_questions: number;
  estimated_remaining: number;
  current_competency: string;
}

// ============ Answer Evaluation ============

export interface AnswerEvaluation {
  relevance: number; // 1-5
  depth: number; // 1-5
  accuracy: number; // 1-5
  examples: number; // 1-5
  communication: number; // 1-5
  reasoning: string;
  overall_score: number; // 1-5, calculated average
  suggested_follow_up?: FollowUpType;
}

// ============ Summary Structures ============

export interface CompetencyScore {
  name: string;
  score: number; // 0-100
  assessment: 'excellent' | 'good' | 'needs_work' | 'poor';
  feedback: string;
}

export interface InterviewSummary {
  overall_score: number; // 0-100
  competency_scores: CompetencyScore[];
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  verdict: Verdict;
  verdict_reasoning: string;
}

// ============ API Response Types ============

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============ Service Health Types ============

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  latency_ms?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  timestamp: string;
}

// ============ LLM Types ============

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
  format?: 'json';
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

// ============ TTS/STT Types ============

export interface TTSRequest {
  text: string;
  voice_id?: string;
  speed?: number;
}

export interface STTResponse {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
  language: string;
  duration: number;
}
