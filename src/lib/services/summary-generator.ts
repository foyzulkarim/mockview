import {
  Session,
  Interview,
  Question,
  Answer,
  Summary,
  JobDescription,
  MatchScore,
} from '../db/models';
import { initializeModels } from '../db/models';
import { generateJSON } from '../ai/ollama';
import {
  SUMMARY_GENERATOR_SYSTEM_PROMPT,
  buildSummaryPrompt,
  buildQuickSummaryPrompt,
} from '../../prompts/summary-generator';
import { updateSessionStatus } from './session';
import { config } from '../config';
import type {
  InterviewSummary,
  ParsedJDData,
  MatchBreakdown,
  AnswerEvaluation,
} from '../types';

// Ensure models are initialized
let modelsInitialized = false;

async function ensureModelsInitialized(): Promise<void> {
  if (!modelsInitialized) {
    await initializeModels();
    modelsInitialized = true;
  }
}

// Types for the AI-generated summary
interface GeneratedSummary {
  overall_rating: 'excellent' | 'good' | 'satisfactory' | 'needs_improvement';
  overall_score: number;
  executive_summary: string;
  strengths: Array<{
    area: string;
    evidence: string;
    impact: string;
  }>;
  areas_for_improvement: Array<{
    area: string;
    issue: string;
    suggestion: string;
    resources?: string[];
  }>;
  competency_scores: Record<string, { score: number; summary: string }>;
  communication_feedback: {
    clarity: number;
    structure: number;
    confidence: number;
    examples_usage: number;
    notes: string;
  };
  recommended_next_steps: string[];
  sample_improved_answers?: Array<{
    question: string;
    improved_answer: string;
  }>;
}

interface QuickSummary {
  overall_rating: string;
  overall_score: number;
  one_liner: string;
  top_strength: string;
  key_improvement: string;
  ready_for_interview: boolean;
}

/**
 * Generate a comprehensive interview summary
 */
export async function generateSummary(sessionUuid: string): Promise<{
  summaryId: number;
  summary: InterviewSummary;
}> {
  await ensureModelsInitialized();

  // Get session
  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) throw new Error('Session not found');

  // Get interview
  const interview = await Interview.findOne({
    where: { session_id: session.id },
    order: [['created_at', 'DESC']],
  });

  if (!interview) throw new Error('No interview found for session');
  if (interview.status !== 'completed') {
    throw new Error('Interview must be completed before generating summary');
  }

  // Check for existing summary
  const existingSummary = await Summary.findOne({
    where: { interview_id: interview.id },
  });

  if (existingSummary) {
    return {
      summaryId: existingSummary.id,
      summary: existingSummary.summary_data as InterviewSummary,
    };
  }

  // Get all questions and answers
  const questions = await Question.findAll({
    where: { interview_id: interview.id },
    order: [['sequence_num', 'ASC']],
  });

  const questionsWithAnswers = await Promise.all(
    questions.map(async (q) => {
      const answer = await Answer.findOne({ where: { question_id: q.id } });
      return {
        question: q.question_text,
        answer: answer?.answer_text || '',
        competency: q.competency,
        score: answer?.quality_score || 0,
        reasoning: (answer?.evaluation as AnswerEvaluation)?.reasoning || '',
      };
    })
  );

  // Filter out unanswered questions
  const answeredQuestions = questionsWithAnswers.filter((qa) => qa.answer);

  // Get JD data
  const jd = await JobDescription.findOne({
    where: { session_id: session.id },
  });
  const jdData = jd?.parsed_data as ParsedJDData | null;

  // Get match data
  const matchScore = await MatchScore.findOne({
    where: { session_id: session.id },
  });
  const matchBreakdown = matchScore?.breakdown as MatchBreakdown | null;

  // Calculate interview duration
  const startedAt = interview.started_at
    ? new Date(interview.started_at)
    : new Date(interview.created_at);
  const completedAt = interview.completed_at
    ? new Date(interview.completed_at)
    : new Date();
  const durationMinutes = Math.round(
    (completedAt.getTime() - startedAt.getTime()) / 1000 / 60
  );

  // Get unique competencies covered
  const competenciesCovered = [...new Set(answeredQuestions.map((q) => q.competency))];

  // Generate summary
  let summaryData: InterviewSummary;

  if (config.dev.mockAiServices) {
    summaryData = getMockSummary(answeredQuestions, competenciesCovered);
  } else {
    const prompt = buildSummaryPrompt(
      {
        jobTitle: jdData?.title || 'Software Engineer',
        company: jdData?.company,
        duration_minutes: durationMinutes,
        questions_answered: answeredQuestions.length,
        competencies_covered: competenciesCovered,
      },
      answeredQuestions,
      {
        overall_score: matchScore?.overall_score || 70,
        strengths: matchBreakdown?.strengths || [],
        gaps: matchBreakdown?.gaps || [],
      }
    );

    const generated = await generateJSON<GeneratedSummary>(
      prompt,
      SUMMARY_GENERATOR_SYSTEM_PROMPT,
      { model: 'heavy' }
    );

    summaryData = transformToInterviewSummary(generated, {
      durationMinutes,
      questionsAnswered: answeredQuestions.length,
      competenciesCovered,
    });
  }

  // Store summary
  const summary = await Summary.create({
    interview_id: interview.id,
    summary_data: summaryData,
    overall_rating: summaryData.overall_rating,
  });

  // Update session status
  await updateSessionStatus(sessionUuid, 'completed');

  return {
    summaryId: summary.id,
    summary: summaryData,
  };
}

/**
 * Get existing summary for a session
 */
export async function getSummary(
  sessionUuid: string
): Promise<InterviewSummary | null> {
  await ensureModelsInitialized();

  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) return null;

  const interview = await Interview.findOne({
    where: { session_id: session.id },
    order: [['created_at', 'DESC']],
  });

  if (!interview) return null;

  const summary = await Summary.findOne({
    where: { interview_id: interview.id },
  });

  if (!summary) return null;

  return summary.summary_data as InterviewSummary;
}

/**
 * Generate a quick summary (lighter weight)
 */
export async function generateQuickSummary(
  sessionUuid: string
): Promise<QuickSummary> {
  await ensureModelsInitialized();

  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) throw new Error('Session not found');

  const interview = await Interview.findOne({
    where: { session_id: session.id },
  });

  if (!interview) throw new Error('No interview found');

  const questions = await Question.findAll({
    where: { interview_id: interview.id },
  });

  const questionsWithAnswers = await Promise.all(
    questions.map(async (q) => {
      const answer = await Answer.findOne({ where: { question_id: q.id } });
      return {
        question: q.question_text,
        answer: answer?.answer_text || '',
        score: answer?.quality_score || 0,
      };
    })
  );

  const answeredQuestions = questionsWithAnswers.filter((qa) => qa.answer);

  if (config.dev.mockAiServices) {
    return getMockQuickSummary(answeredQuestions);
  }

  const prompt = buildQuickSummaryPrompt(answeredQuestions);

  return await generateJSON<QuickSummary>(prompt, SUMMARY_GENERATOR_SYSTEM_PROMPT, {
    model: 'light',
  });
}

/**
 * Transform AI-generated summary to our InterviewSummary type
 */
function transformToInterviewSummary(
  generated: GeneratedSummary,
  metadata: {
    durationMinutes: number;
    questionsAnswered: number;
    competenciesCovered: string[];
  }
): InterviewSummary {
  return {
    overall_rating: generated.overall_rating,
    overall_score: generated.overall_score,
    executive_summary: generated.executive_summary,
    duration_minutes: metadata.durationMinutes,
    questions_answered: metadata.questionsAnswered,
    competencies_covered: metadata.competenciesCovered,
    strengths: generated.strengths,
    areas_for_improvement: generated.areas_for_improvement,
    competency_scores: generated.competency_scores,
    communication_feedback: generated.communication_feedback,
    recommended_next_steps: generated.recommended_next_steps,
    sample_improved_answers: generated.sample_improved_answers,
  };
}

/**
 * Mock summary for development
 */
function getMockSummary(
  questionsWithAnswers: Array<{ question: string; answer: string; competency: string; score: number }>,
  competenciesCovered: string[]
): InterviewSummary {
  const avgScore =
    questionsWithAnswers.reduce((sum, qa) => sum + qa.score, 0) /
    (questionsWithAnswers.length || 1);
  const overallScore = Math.round(avgScore * 20);

  const rating =
    overallScore >= 80
      ? 'excellent'
      : overallScore >= 65
        ? 'good'
        : overallScore >= 50
          ? 'satisfactory'
          : 'needs_improvement';

  return {
    overall_rating: rating,
    overall_score: overallScore,
    executive_summary: `Based on your mock interview performance, you demonstrated ${rating} readiness for this role. Your responses showed good understanding of technical concepts with room for improvement in providing specific examples.`,
    duration_minutes: questionsWithAnswers.length * 4,
    questions_answered: questionsWithAnswers.length,
    competencies_covered: competenciesCovered,
    strengths: [
      {
        area: 'Technical Knowledge',
        evidence: 'Demonstrated solid understanding of core technologies',
        impact: 'Essential for day-to-day responsibilities in this role',
      },
      {
        area: 'Communication',
        evidence: 'Responses were generally clear and well-structured',
        impact: 'Important for team collaboration and stakeholder communication',
      },
    ],
    areas_for_improvement: [
      {
        area: 'Specific Examples',
        issue: 'Some responses lacked concrete examples from past experience',
        suggestion: 'Prepare 3-5 detailed STAR stories for common interview scenarios',
        resources: ['STAR Method Guide', 'Behavioral Interview Prep'],
      },
      {
        area: 'Technical Depth',
        issue: 'Could provide more detailed technical explanations',
        suggestion: 'Practice explaining complex concepts at different levels of detail',
      },
    ],
    competency_scores: Object.fromEntries(
      competenciesCovered.map((comp) => [
        comp,
        {
          score: Math.round(2 + Math.random() * 2),
          summary: `Showed adequate understanding with room for deeper exploration`,
        },
      ])
    ),
    communication_feedback: {
      clarity: 4,
      structure: 3,
      confidence: 3,
      examples_usage: 2,
      notes: 'Good overall communication. Consider using the STAR format more consistently when sharing examples.',
    },
    recommended_next_steps: [
      'Review and practice explaining your most impactful projects',
      'Prepare specific metrics and outcomes for your achievements',
      'Practice answering follow-up questions that probe deeper into your experience',
      'Research common system design questions for this role level',
    ],
    sample_improved_answers: [
      {
        question: questionsWithAnswers[0]?.question || 'Tell me about a challenging project',
        improved_answer: 'In my role at [Company], I led the development of a microservices migration that reduced our deployment time by 70%. The challenge was coordinating across 5 teams while maintaining zero downtime. I implemented a feature flag system and staged rollout process. The result was a successful migration over 3 months with no customer-facing incidents.',
      },
    ],
  };
}

/**
 * Mock quick summary for development
 */
function getMockQuickSummary(
  questionsWithAnswers: Array<{ score: number }>
): QuickSummary {
  const avgScore =
    questionsWithAnswers.reduce((sum, qa) => sum + qa.score, 0) /
    (questionsWithAnswers.length || 1);
  const overallScore = Math.round(avgScore * 20);

  return {
    overall_rating:
      overallScore >= 80
        ? 'excellent'
        : overallScore >= 65
          ? 'good'
          : overallScore >= 50
            ? 'satisfactory'
            : 'needs_improvement',
    overall_score: overallScore,
    one_liner: `You performed ${overallScore >= 70 ? 'well' : 'adequately'} and should focus on providing more specific examples.`,
    top_strength: 'Technical knowledge and problem-solving approach',
    key_improvement: 'Providing concrete examples with measurable outcomes',
    ready_for_interview: overallScore >= 70,
  };
}
