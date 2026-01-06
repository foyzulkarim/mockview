import { MatchScore, Session, CV, JobDescription } from '../db/models';
import { initializeModels } from '../db/models';
import { generateJSON } from '../ai/ollama';
import { MATCH_SCORER_SYSTEM_PROMPT, buildMatchScorerPrompt } from '../../prompts/match-scorer';
import { updateSessionStatus } from './session';
import { config } from '../config';
import type { ParsedCVData, ParsedJDData, MatchBreakdown } from '../types';

// Ensure models are initialized
let modelsInitialized = false;

async function ensureModelsInitialized(): Promise<void> {
  if (!modelsInitialized) {
    await initializeModels();
    modelsInitialized = true;
  }
}

interface MatchResult {
  overall_score: number;
  breakdown: MatchBreakdown;
}

/**
 * Calculate match score between CV and JD using LLM
 */
export async function calculateMatch(
  cvData: ParsedCVData,
  jdData: ParsedJDData
): Promise<MatchResult> {
  // Use mock data if AI services are mocked
  if (config.dev.mockAiServices) {
    return getMockMatchResult(cvData, jdData);
  }

  const prompt = buildMatchScorerPrompt(cvData, jdData);

  try {
    const result = await generateJSON<MatchResult>(
      prompt,
      MATCH_SCORER_SYSTEM_PROMPT,
      { model: 'light' }
    );

    // Validate and normalize the result
    validateMatchResult(result);
    normalizeScores(result);

    return result;
  } catch (error) {
    console.error('Match calculation failed:', error);
    throw new Error(`Match calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate match result structure
 */
function validateMatchResult(result: MatchResult): void {
  if (typeof result.overall_score !== 'number') {
    throw new Error('Invalid match result: missing overall_score');
  }
  if (!result.breakdown) {
    throw new Error('Invalid match result: missing breakdown');
  }
  if (!result.breakdown.technical_skills || typeof result.breakdown.technical_skills.score !== 'number') {
    throw new Error('Invalid match result: missing technical_skills score');
  }
}

/**
 * Normalize scores to ensure they're within valid range
 */
function normalizeScores(result: MatchResult): void {
  // Clamp overall score
  result.overall_score = Math.max(0, Math.min(100, Math.round(result.overall_score)));

  // Clamp category scores
  const categories = ['technical_skills', 'experience_level', 'required_technologies', 'soft_skills'] as const;
  for (const cat of categories) {
    if (result.breakdown[cat] && typeof result.breakdown[cat].score === 'number') {
      result.breakdown[cat].score = Math.max(0, Math.min(100, Math.round(result.breakdown[cat].score)));
    }
  }

  // Ensure arrays exist
  result.breakdown.strengths = result.breakdown.strengths || [];
  result.breakdown.gaps = result.breakdown.gaps || [];
}

/**
 * Process match calculation for a session
 */
export async function processMatchCalculation(sessionUuid: string): Promise<{
  matchScoreId: number;
  overallScore: number;
  breakdown: MatchBreakdown;
}> {
  await ensureModelsInitialized();

  // Get session
  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) {
    throw new Error('Session not found');
  }

  // Get CV data
  const cv = await CV.findOne({ where: { session_id: session.id } });
  if (!cv || !cv.parsed_data) {
    throw new Error('CV not found or not parsed. Please upload your CV first.');
  }

  // Get JD data
  const jd = await JobDescription.findOne({ where: { session_id: session.id } });
  if (!jd || !jd.parsed_data) {
    throw new Error('Job description not found or not parsed. Please submit the job description first.');
  }

  // Check if match score already exists
  const existingScore = await MatchScore.findOne({ where: { session_id: session.id } });
  if (existingScore) {
    // Delete existing score to recalculate
    await existingScore.destroy();
  }

  // Calculate match
  const result = await calculateMatch(cv.parsed_data, jd.parsed_data);

  // Store in database
  const matchScore = await MatchScore.create({
    session_id: session.id,
    overall_score: result.overall_score,
    breakdown: result.breakdown,
  });

  // Update session status
  await updateSessionStatus(sessionUuid, 'scored');

  return {
    matchScoreId: matchScore.id,
    overallScore: result.overall_score,
    breakdown: result.breakdown,
  };
}

/**
 * Get match score for a session
 */
export async function getMatchScore(sessionUuid: string): Promise<{
  overallScore: number;
  breakdown: MatchBreakdown;
  canStartInterview: boolean;
} | null> {
  await ensureModelsInitialized();

  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) {
    return null;
  }

  const matchScore = await MatchScore.findOne({ where: { session_id: session.id } });
  if (!matchScore) {
    return null;
  }

  return {
    overallScore: matchScore.overall_score,
    breakdown: matchScore.breakdown,
    canStartInterview: matchScore.overall_score >= config.interview.minMatchScore,
  };
}

/**
 * Mock match result for development without AI services
 */
function getMockMatchResult(cvData: ParsedCVData, jdData: ParsedJDData): MatchResult {
  // Simple algorithmic matching for mock mode
  const cvSkills = new Set(cvData.skills?.technical?.map(s => s.toLowerCase()) || []);
  const jdMustHave = jdData.requirements?.must_have?.map(s => s.toLowerCase()) || [];
  const jdNiceToHave = jdData.requirements?.nice_to_have?.map(s => s.toLowerCase()) || [];

  // Calculate skill overlap
  const matchedMustHave = jdMustHave.filter(skill =>
    Array.from(cvSkills).some(cvSkill => cvSkill.includes(skill) || skill.includes(cvSkill))
  );
  const missingMustHave = jdMustHave.filter(skill => !matchedMustHave.includes(skill));

  const matchedNiceToHave = jdNiceToHave.filter(skill =>
    Array.from(cvSkills).some(cvSkill => cvSkill.includes(skill) || skill.includes(cvSkill))
  );

  // Calculate scores
  const technicalScore = jdMustHave.length > 0
    ? Math.round((matchedMustHave.length / jdMustHave.length) * 100)
    : 50;

  const experienceScore = cvData.inferred_seniority === jdData.inferred_seniority ? 90 : 70;
  const techScore = technicalScore;
  const softSkillScore = 85;

  const overallScore = Math.round(
    technicalScore * 0.35 +
    experienceScore * 0.25 +
    techScore * 0.25 +
    softSkillScore * 0.15
  );

  return {
    overall_score: overallScore,
    breakdown: {
      technical_skills: {
        score: technicalScore,
        matched: matchedMustHave,
        missing: missingMustHave,
      },
      experience_level: {
        score: experienceScore,
        cv_level: cvData.inferred_seniority,
        jd_level: jdData.inferred_seniority,
        assessment: cvData.inferred_seniority === jdData.inferred_seniority
          ? 'Good alignment with required experience level'
          : 'Experience level differs from requirements',
      },
      required_technologies: {
        score: techScore,
        matched: matchedMustHave,
        missing: missingMustHave,
      },
      soft_skills: {
        score: softSkillScore,
        matched: cvData.skills?.soft?.slice(0, 3) || [],
        assessment: 'Good soft skills alignment',
      },
      strengths: [
        `Strong experience in ${matchedMustHave.slice(0, 2).join(' and ') || 'relevant technologies'}`,
        `${cvData.total_years_experience} years of industry experience`,
        'Solid educational background',
      ],
      gaps: missingMustHave.length > 0
        ? [`Limited exposure to ${missingMustHave.slice(0, 2).join(' and ')}`]
        : ['Minor gaps in nice-to-have skills'],
    },
  };
}
