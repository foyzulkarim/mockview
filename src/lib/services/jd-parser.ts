import { JobDescription, Session } from '../db/models';
import { initializeModels } from '../db/models';
import { generateJSON } from '../ai/ollama';
import { JD_PARSER_SYSTEM_PROMPT, buildJDParserPrompt } from '../../prompts/jd-parser';
import { updateSessionStatus } from './session';
import { config } from '../config';
import type { ParsedJDData } from '../types';

// Ensure models are initialized
let modelsInitialized = false;

async function ensureModelsInitialized(): Promise<void> {
  if (!modelsInitialized) {
    await initializeModels();
    modelsInitialized = true;
  }
}

/**
 * Parse job description text using Ollama LLM
 */
export async function parseJD(jdText: string): Promise<ParsedJDData> {
  // Use mock data if AI services are mocked
  if (config.dev.mockAiServices) {
    return getMockParsedJD();
  }

  const prompt = buildJDParserPrompt(jdText);

  try {
    const parsed = await generateJSON<ParsedJDData>(
      prompt,
      JD_PARSER_SYSTEM_PROMPT,
      { model: 'light' }
    );

    // Validate required fields
    validateParsedJD(parsed);

    // Normalize competency weights to sum to 1.0
    normalizeCompetencyWeights(parsed);

    return parsed;
  } catch (error) {
    console.error('JD parsing failed:', error);
    throw new Error(`JD parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate parsed JD data has required structure
 */
function validateParsedJD(data: ParsedJDData): void {
  if (!data.title || data.title.trim().length === 0) {
    throw new Error('Invalid JD data: missing job title');
  }
  if (!data.requirements || !data.requirements.must_have) {
    throw new Error('Invalid JD data: missing requirements.must_have');
  }
  if (!Array.isArray(data.competency_areas)) {
    throw new Error('Invalid JD data: competency_areas must be an array');
  }
  if (!data.inferred_seniority) {
    throw new Error('Invalid JD data: missing inferred_seniority');
  }
}

/**
 * Normalize competency area weights to sum to 1.0
 */
function normalizeCompetencyWeights(data: ParsedJDData): void {
  if (data.competency_areas.length === 0) {
    return;
  }

  const totalWeight = data.competency_areas.reduce((sum, area) => sum + area.weight, 0);

  if (totalWeight > 0 && Math.abs(totalWeight - 1.0) > 0.01) {
    // Normalize weights
    data.competency_areas.forEach(area => {
      area.weight = area.weight / totalWeight;
    });
  }
}

/**
 * Process job description: parse and store
 */
export async function processJD(
  sessionUuid: string,
  jdText: string
): Promise<{
  jdId: number;
  parsedData: ParsedJDData;
}> {
  await ensureModelsInitialized();

  // Get session
  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) {
    throw new Error('Session not found');
  }

  // Check if JD already exists for this session
  const existingJD = await JobDescription.findOne({ where: { session_id: session.id } });
  if (existingJD) {
    // Delete existing JD to replace
    await existingJD.destroy();
  }

  // Validate text length
  if (jdText.trim().length < 50) {
    throw new Error('Job description appears to be empty or too short.');
  }

  // Parse JD
  const parsedData = await parseJD(jdText);

  // Store in database
  const jd = await JobDescription.create({
    session_id: session.id,
    raw_text: jdText,
    parsed_data: parsedData,
  });

  // Update session status
  await updateSessionStatus(sessionUuid, 'jd_submitted');

  return {
    jdId: jd.id,
    parsedData,
  };
}

/**
 * Get parsed JD data for a session
 */
export async function getParsedJD(sessionUuid: string): Promise<ParsedJDData | null> {
  await ensureModelsInitialized();

  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) {
    return null;
  }

  const jd = await JobDescription.findOne({ where: { session_id: session.id } });
  if (!jd || !jd.parsed_data) {
    return null;
  }

  return jd.parsed_data;
}

/**
 * Mock parsed JD for development without AI services
 */
function getMockParsedJD(): ParsedJDData {
  return {
    title: 'Senior Full Stack Engineer',
    company: 'Innovative Tech',
    requirements: {
      must_have: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
      nice_to_have: ['Kubernetes', 'GraphQL', 'AWS'],
      experience_years: { min: 5, max: 8 },
    },
    responsibilities: [
      'Design and implement scalable web applications',
      'Lead technical discussions and architecture decisions',
      'Mentor junior team members',
    ],
    soft_skills: ['Communication', 'Leadership', 'Problem Solving'],
    inferred_seniority: 'senior',
    competency_areas: [
      { name: 'Frontend', weight: 0.3, skills: ['React', 'TypeScript', 'CSS'] },
      { name: 'Backend', weight: 0.35, skills: ['Node.js', 'APIs', 'Databases'] },
      { name: 'DevOps', weight: 0.15, skills: ['Docker', 'CI/CD'] },
      { name: 'Soft Skills', weight: 0.2, skills: ['Communication', 'Leadership'] },
    ],
  };
}
