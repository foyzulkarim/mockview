import {
  Interview,
  Question,
  Answer,
  Session,
  CV,
  JobDescription,
} from '../db/models';
import { initializeModels } from '../db/models';
import { generateJSON } from '../ai/ollama';
import {
  QUESTION_GENERATOR_SYSTEM_PROMPT,
  buildInitialQuestionPrompt,
  buildFollowUpQuestionPrompt,
} from '../../prompts/question-generator';
import {
  RESPONSE_EVALUATOR_SYSTEM_PROMPT,
  buildResponseEvaluatorPrompt,
} from '../../prompts/response-evaluator';
import { updateSessionStatus } from './session';
import { config } from '../config';
import type {
  ParsedCVData,
  ParsedJDData,
  QuestionPlan,
  InterviewState,
  AnswerEvaluation,
  CompetencyArea,
  FollowUpType,
} from '../types';

// Ensure models are initialized
let modelsInitialized = false;

async function ensureModelsInitialized(): Promise<void> {
  if (!modelsInitialized) {
    await initializeModels();
    modelsInitialized = true;
  }
}

// ============ Types ============

interface GeneratedQuestion {
  question_text: string;
  competency: string;
  expected_topics: string[];
  difficulty?: string;
  type: string;
  follow_up_type?: FollowUpType;
  transition?: string;
}

interface EvaluationResult {
  relevance: number;
  depth: number;
  accuracy: number;
  examples: number;
  communication: number;
  overall_score: number;
  reasoning: string;
  suggested_follow_up: 'clarify' | 'probe' | 'none';
  key_points_covered: string[];
  missed_opportunities: string[];
}

// ============ Question Plan Generation ============

/**
 * Generate the initial question plan based on JD competency areas
 */
export function generateQuestionPlan(jdData: ParsedJDData): QuestionPlan {
  const competencies = jdData.competency_areas || [];
  const totalWeight = competencies.reduce((sum, c) => sum + c.weight, 0);

  // Allocate questions proportional to weight, minimum 1 per competency
  const targetTotal = config.interview.maxQuestions;
  const plannedCompetencies = competencies.map(comp => {
    const normalizedWeight = totalWeight > 0 ? comp.weight / totalWeight : 1 / competencies.length;
    const plannedQuestions = Math.max(1, Math.round(normalizedWeight * targetTotal));

    return {
      name: comp.name,
      weight: comp.weight,
      planned_questions: plannedQuestions,
      skills_to_cover: comp.skills,
    };
  });

  // Adjust total if needed
  const actualTotal = plannedCompetencies.reduce((sum, c) => sum + c.planned_questions, 0);

  return {
    competencies: plannedCompetencies,
    total_planned_questions: actualTotal,
    estimated_duration_minutes: actualTotal * 4, // ~4 min per question
  };
}

/**
 * Initialize interview state
 */
export function initializeInterviewState(questionPlan: QuestionPlan): InterviewState {
  const competencies: InterviewState['competencies'] = {};

  for (const comp of questionPlan.competencies) {
    competencies[comp.name] = {
      status: 'pending',
      questions_asked: 0,
      current_depth: 0,
      avg_score: 0,
    };
  }

  const firstCompetency = questionPlan.competencies[0]?.name || '';
  if (firstCompetency) {
    competencies[firstCompetency].status = 'in_progress';
  }

  return {
    competencies,
    total_questions: 0,
    estimated_remaining: questionPlan.total_planned_questions,
    current_competency: firstCompetency,
  };
}

// ============ Question Generation ============

/**
 * Generate an initial question for a competency
 */
export async function generateQuestion(
  cvData: ParsedCVData,
  jdData: ParsedJDData,
  competency: CompetencyArea,
  questionNumber: number
): Promise<GeneratedQuestion> {
  if (config.dev.mockAiServices) {
    return getMockQuestion(competency, questionNumber);
  }

  const prompt = buildInitialQuestionPrompt(cvData, jdData, competency, questionNumber);

  const result = await generateJSON<GeneratedQuestion>(
    prompt,
    QUESTION_GENERATOR_SYSTEM_PROMPT,
    { model: 'heavy' }
  );

  return result;
}

/**
 * Generate a follow-up question based on previous answer
 */
export async function generateFollowUp(
  previousQuestion: string,
  previousAnswer: string,
  evaluationReasoning: string,
  competency: string,
  followUpType: FollowUpType,
  depth: number
): Promise<GeneratedQuestion> {
  if (config.dev.mockAiServices) {
    return getMockFollowUp(competency, followUpType, depth);
  }

  const prompt = buildFollowUpQuestionPrompt(
    previousQuestion,
    previousAnswer,
    evaluationReasoning,
    competency,
    followUpType,
    depth
  );

  const result = await generateJSON<GeneratedQuestion>(
    prompt,
    QUESTION_GENERATOR_SYSTEM_PROMPT,
    { model: 'heavy' }
  );

  return result;
}

// ============ Response Evaluation ============

/**
 * Evaluate a candidate's response
 */
export async function evaluateResponse(
  question: string,
  answer: string,
  competency: string,
  expectedTopics: string[]
): Promise<EvaluationResult> {
  if (config.dev.mockAiServices) {
    return getMockEvaluation(answer);
  }

  const prompt = buildResponseEvaluatorPrompt(question, answer, competency, expectedTopics);

  const result = await generateJSON<EvaluationResult>(
    prompt,
    RESPONSE_EVALUATOR_SYSTEM_PROMPT,
    { model: 'heavy' }
  );

  // Normalize scores
  result.overall_score = Math.max(1, Math.min(5, result.overall_score));

  return result;
}

// ============ Adaptive Logic ============

/**
 * Determine next action based on evaluation
 */
export function determineNextAction(
  evaluation: EvaluationResult,
  currentDepth: number,
  maxDepth: number
): { action: 'follow_up' | 'next_question' | 'next_competency' | 'end_interview'; followUpType?: FollowUpType } {
  const score = evaluation.overall_score;
  const suggested = evaluation.suggested_follow_up;

  // Strong answer (4-5) or max depth reached: move on
  if (score >= 4 || currentDepth >= maxDepth) {
    return { action: 'next_question' };
  }

  // Weak answer (1-2) and room for follow-up: clarify
  if (score <= 2 && currentDepth < maxDepth) {
    return { action: 'follow_up', followUpType: 'clarify' };
  }

  // Okay answer (3) and room for follow-up: probe
  if (score === 3 && currentDepth < maxDepth && suggested === 'probe') {
    return { action: 'follow_up', followUpType: 'probe' };
  }

  // Default: move to next question
  return { action: 'next_question' };
}

// ============ Main Interview Functions ============

/**
 * Start a new interview
 */
export async function startInterview(sessionUuid: string): Promise<{
  interviewId: number;
  question: {
    id: number;
    text: string;
    competency: string;
  };
  progress: {
    current: number;
    estimated_total: number;
    competency: string;
  };
}> {
  await ensureModelsInitialized();

  // Get session and data
  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) throw new Error('Session not found');

  const cv = await CV.findOne({ where: { session_id: session.id } });
  const jd = await JobDescription.findOne({ where: { session_id: session.id } });

  if (!cv?.parsed_data || !jd?.parsed_data) {
    throw new Error('CV and JD must be parsed before starting interview');
  }

  // Check for existing interview
  const existingInterview = await Interview.findOne({
    where: { session_id: session.id },
  });
  if (existingInterview) {
    await existingInterview.destroy();
  }

  // Generate question plan
  const questionPlan = generateQuestionPlan(jd.parsed_data);
  const interviewState = initializeInterviewState(questionPlan);

  // Create interview record
  const interview = await Interview.create({
    session_id: session.id,
    status: 'in_progress',
    question_plan: questionPlan,
    interview_state: interviewState,
    started_at: new Date(),
  });

  // Generate first question
  const firstCompetency = jd.parsed_data.competency_areas[0];
  const generatedQuestion = await generateQuestion(
    cv.parsed_data,
    jd.parsed_data,
    firstCompetency,
    1
  );

  // Store question
  const question = await Question.create({
    interview_id: interview.id,
    sequence_num: 1,
    competency: generatedQuestion.competency,
    question_text: generatedQuestion.question_text,
    depth_level: 0,
  });

  // Update session status
  await updateSessionStatus(sessionUuid, 'interviewing');

  return {
    interviewId: interview.id,
    question: {
      id: question.id,
      text: question.question_text,
      competency: question.competency,
    },
    progress: {
      current: 1,
      estimated_total: questionPlan.total_planned_questions,
      competency: firstCompetency.name,
    },
  };
}

/**
 * Process an answer and get next question or complete interview
 */
export async function processAnswer(
  sessionUuid: string,
  questionId: number,
  answerText: string,
  responseTimeMs?: number
): Promise<{
  evaluation: AnswerEvaluation;
  nextQuestion?: {
    id: number;
    text: string;
    competency: string;
    isFollowUp: boolean;
    depth: number;
  };
  progress: {
    current: number;
    estimated_total: number;
    competency: string;
  };
  isComplete: boolean;
}> {
  await ensureModelsInitialized();

  // Get session and interview
  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) throw new Error('Session not found');

  const interview = await Interview.findOne({
    where: { session_id: session.id, status: 'in_progress' },
  });
  if (!interview) throw new Error('No active interview found');

  // Get the question
  const question = await Question.findByPk(questionId);
  if (!question || question.interview_id !== interview.id) {
    throw new Error('Question not found');
  }

  // Get CV and JD data for context
  const cv = await CV.findOne({ where: { session_id: session.id } });
  const jd = await JobDescription.findOne({ where: { session_id: session.id } });

  if (!cv?.parsed_data || !jd?.parsed_data) {
    throw new Error('Session data not found');
  }

  // Evaluate the response
  const evalResult = await evaluateResponse(
    question.question_text,
    answerText,
    question.competency,
    [] // expectedTopics could be stored with question
  );

  // Create answer evaluation object
  const evaluation: AnswerEvaluation = {
    relevance: evalResult.relevance,
    depth: evalResult.depth,
    accuracy: evalResult.accuracy,
    examples: evalResult.examples,
    communication: evalResult.communication,
    reasoning: evalResult.reasoning,
    overall_score: evalResult.overall_score,
    suggested_follow_up: evalResult.suggested_follow_up === 'none' ? undefined :
      evalResult.suggested_follow_up as FollowUpType,
  };

  // Store answer
  await Answer.create({
    question_id: questionId,
    answer_text: answerText,
    response_time_ms: responseTimeMs || null,
    evaluation,
    quality_score: Math.round(evalResult.overall_score),
  });

  // Update interview state
  const state = interview.interview_state as InterviewState;
  state.total_questions += 1;

  // Update competency stats
  const compState = state.competencies[question.competency];
  if (compState) {
    compState.questions_asked += 1;
    compState.avg_score = (compState.avg_score * (compState.questions_asked - 1) + evalResult.overall_score) / compState.questions_asked;
  }

  // Determine next action
  const nextAction = determineNextAction(
    evalResult,
    question.depth_level,
    config.interview.maxFollowUpDepth
  );

  // Count total questions asked
  const questionsAsked = await Question.count({ where: { interview_id: interview.id } });

  // Check if interview should end
  const shouldEnd =
    questionsAsked >= config.interview.maxQuestions ||
    Object.values(state.competencies).every(c => c.status === 'completed');

  if (shouldEnd) {
    await interview.update({
      status: 'completed',
      interview_state: state,
      completed_at: new Date(),
    });

    await updateSessionStatus(sessionUuid, 'completed');

    return {
      evaluation,
      progress: {
        current: questionsAsked,
        estimated_total: questionsAsked,
        competency: question.competency,
      },
      isComplete: true,
    };
  }

  // Generate next question based on action
  let nextQuestion;

  if (nextAction.action === 'follow_up' && nextAction.followUpType) {
    // Generate follow-up
    const followUp = await generateFollowUp(
      question.question_text,
      answerText,
      evalResult.reasoning,
      question.competency,
      nextAction.followUpType,
      question.depth_level + 1
    );

    const newQuestion = await Question.create({
      interview_id: interview.id,
      parent_id: questionId,
      sequence_num: questionsAsked + 1,
      competency: question.competency,
      question_text: followUp.question_text,
      depth_level: question.depth_level + 1,
    });

    nextQuestion = {
      id: newQuestion.id,
      text: newQuestion.question_text,
      competency: newQuestion.competency,
      isFollowUp: true,
      depth: newQuestion.depth_level,
    };

    // Update depth tracking
    if (compState) {
      compState.current_depth = newQuestion.depth_level;
    }
  } else {
    // Move to next question in same competency or next competency
    const plan = interview.question_plan as QuestionPlan;
    const currentCompIdx = plan.competencies.findIndex(c => c.name === question.competency);
    const currentComp = plan.competencies[currentCompIdx];

    // Check if we need more questions in current competency
    const questionsInComp = await Question.count({
      where: {
        interview_id: interview.id,
        competency: question.competency,
        depth_level: 0, // Only count root questions
      },
    });

    let targetCompetency: CompetencyArea;

    if (currentComp && questionsInComp < currentComp.planned_questions) {
      // More questions needed in current competency
      targetCompetency = jd.parsed_data.competency_areas.find(c => c.name === question.competency)!;
    } else {
      // Move to next competency
      if (compState) {
        compState.status = 'completed';
        compState.current_depth = 0;
      }

      const nextCompIdx = currentCompIdx + 1;
      if (nextCompIdx < plan.competencies.length) {
        const nextComp = plan.competencies[nextCompIdx];
        targetCompetency = jd.parsed_data.competency_areas.find(c => c.name === nextComp.name)!;
        state.current_competency = nextComp.name;

        if (state.competencies[nextComp.name]) {
          state.competencies[nextComp.name].status = 'in_progress';
        }
      } else {
        // No more competencies, end interview
        await interview.update({
          status: 'completed',
          interview_state: state,
          completed_at: new Date(),
        });

        return {
          evaluation,
          progress: {
            current: questionsAsked,
            estimated_total: questionsAsked,
            competency: question.competency,
          },
          isComplete: true,
        };
      }
    }

    // Generate new question
    const generated = await generateQuestion(
      cv.parsed_data,
      jd.parsed_data,
      targetCompetency,
      questionsAsked + 1
    );

    const newQuestion = await Question.create({
      interview_id: interview.id,
      sequence_num: questionsAsked + 1,
      competency: targetCompetency.name,
      question_text: generated.question_text,
      depth_level: 0,
    });

    nextQuestion = {
      id: newQuestion.id,
      text: newQuestion.question_text,
      competency: newQuestion.competency,
      isFollowUp: false,
      depth: 0,
    };
  }

  // Update interview state
  state.estimated_remaining = Math.max(0, state.estimated_remaining - 1);
  await interview.update({ interview_state: state });

  return {
    evaluation,
    nextQuestion,
    progress: {
      current: questionsAsked + 1,
      estimated_total: (interview.question_plan as QuestionPlan).total_planned_questions,
      competency: nextQuestion.competency,
    },
    isComplete: false,
  };
}

/**
 * Get current interview state
 */
export async function getInterviewState(sessionUuid: string): Promise<{
  interviewId: number;
  status: string;
  currentQuestion?: {
    id: number;
    text: string;
    competency: string;
  };
  progress: {
    current: number;
    estimated_total: number;
    competency: string;
  };
} | null> {
  await ensureModelsInitialized();

  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) return null;

  const interview = await Interview.findOne({
    where: { session_id: session.id },
    order: [['created_at', 'DESC']],
  });

  if (!interview) return null;

  // Get the most recent unanswered question
  const questions = await Question.findAll({
    where: { interview_id: interview.id },
    order: [['sequence_num', 'DESC']],
    limit: 1,
  });

  const latestQuestion = questions[0];
  let currentQuestion;

  if (latestQuestion) {
    const answer = await Answer.findOne({
      where: { question_id: latestQuestion.id },
    });

    if (!answer) {
      currentQuestion = {
        id: latestQuestion.id,
        text: latestQuestion.question_text,
        competency: latestQuestion.competency,
      };
    }
  }

  const state = interview.interview_state as InterviewState;
  const plan = interview.question_plan as QuestionPlan;

  return {
    interviewId: interview.id,
    status: interview.status,
    currentQuestion,
    progress: {
      current: state.total_questions + (currentQuestion ? 1 : 0),
      estimated_total: plan.total_planned_questions,
      competency: state.current_competency,
    },
  };
}

// ============ Mock Functions ============

function getMockQuestion(competency: CompetencyArea, questionNumber: number): GeneratedQuestion {
  const questions: Record<string, string[]> = {
    'Frontend': [
      'Tell me about a complex React component you built. What were the main challenges?',
      'How do you approach state management in large applications?',
    ],
    'Backend': [
      'Describe a time when you had to optimize a slow API endpoint.',
      'How do you design APIs for scalability?',
    ],
    'DevOps': [
      'How have you used Docker in your development workflow?',
      'Tell me about your experience with CI/CD pipelines.',
    ],
    'Soft Skills': [
      'Tell me about a time when you had to mentor a junior developer.',
      'How do you handle disagreements in code reviews?',
    ],
  };

  const categoryQuestions = questions[competency.name] || questions['Backend'];
  const questionText = categoryQuestions[questionNumber % categoryQuestions.length];

  return {
    question_text: questionText,
    competency: competency.name,
    expected_topics: competency.skills.slice(0, 3),
    type: 'behavioral',
  };
}

function getMockFollowUp(competency: string, followUpType: FollowUpType, depth: number): GeneratedQuestion {
  const clarifyQuestions = [
    'Could you give me a specific example of that?',
    'Walk me through the steps you took.',
    'What was the specific outcome?',
  ];

  const probeQuestions = [
    'How would you approach it differently today?',
    'What were the trade-offs you considered?',
    'How did you measure success?',
  ];

  const questions = followUpType === 'clarify' ? clarifyQuestions : probeQuestions;

  return {
    question_text: questions[depth % questions.length],
    competency,
    expected_topics: [],
    type: 'follow_up',
    follow_up_type: followUpType,
  };
}

function getMockEvaluation(answer: string): EvaluationResult {
  // Simple mock evaluation based on answer length
  const length = answer.length;
  const baseScore = length > 200 ? 4 : length > 100 ? 3 : 2;

  return {
    relevance: baseScore,
    depth: baseScore,
    accuracy: baseScore,
    examples: Math.max(1, baseScore - 1),
    communication: baseScore,
    overall_score: baseScore,
    reasoning: 'Mock evaluation based on answer length.',
    suggested_follow_up: baseScore <= 2 ? 'clarify' : baseScore === 3 ? 'probe' : 'none',
    key_points_covered: ['Some relevant points'],
    missed_opportunities: [],
  };
}
