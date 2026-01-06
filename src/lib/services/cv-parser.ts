import { PDFParse } from 'pdf-parse';
import { CV, Session } from '../db/models';
import { initializeModels } from '../db/models';
import { generateJSON } from '../ai/ollama';
import { CV_PARSER_SYSTEM_PROMPT, buildCVParserPrompt } from '../../prompts/cv-parser';
import { updateSessionStatus } from './session';
import { config } from '../config';
import type { ParsedCVData } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Ensure models are initialized
let modelsInitialized = false;

async function ensureModelsInitialized(): Promise<void> {
  if (!modelsInitialized) {
    await initializeModels();
    modelsInitialized = true;
  }
}

/**
 * Extract text from a PDF buffer
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse v2 uses PDFParse class with LoadParameters
    const uint8Array = new Uint8Array(buffer);
    const parser = new PDFParse({ data: uint8Array });
    const textResult = await parser.getText();
    await parser.destroy();
    return textResult.text;
  } catch (error) {
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save uploaded CV file to disk
 */
export async function saveCVFile(
  sessionId: number,
  buffer: Buffer,
  originalName: string
): Promise<string> {
  const ext = path.extname(originalName);
  const filename = `cv_${sessionId}_${Date.now()}${ext}`;
  const filepath = path.join(config.files.uploadsDir, filename);

  // Ensure directory exists
  await fs.mkdir(config.files.uploadsDir, { recursive: true });

  // Write file
  await fs.writeFile(filepath, buffer);

  return filepath;
}

/**
 * Parse CV text using Ollama LLM
 */
export async function parseCV(cvText: string): Promise<ParsedCVData> {
  // Use mock data if AI services are mocked
  if (config.dev.mockAiServices) {
    return getMockParsedCV();
  }

  const prompt = buildCVParserPrompt(cvText);

  try {
    const parsed = await generateJSON<ParsedCVData>(
      prompt,
      CV_PARSER_SYSTEM_PROMPT,
      { model: 'light' }
    );

    // Validate required fields
    validateParsedCV(parsed);

    return parsed;
  } catch (error) {
    console.error('CV parsing failed:', error);
    throw new Error(`CV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate parsed CV data has required structure
 */
function validateParsedCV(data: ParsedCVData): void {
  if (!data.skills || !data.skills.technical) {
    throw new Error('Invalid CV data: missing skills.technical');
  }
  if (!Array.isArray(data.experience)) {
    throw new Error('Invalid CV data: experience must be an array');
  }
  if (!data.inferred_seniority) {
    throw new Error('Invalid CV data: missing inferred_seniority');
  }
  if (typeof data.total_years_experience !== 'number') {
    throw new Error('Invalid CV data: total_years_experience must be a number');
  }
}

/**
 * Process CV upload: save file, extract text, parse, and store
 */
export async function processCV(
  sessionUuid: string,
  fileBuffer: Buffer,
  originalName: string,
  fileType: 'pdf' | 'txt'
): Promise<{
  cvId: number;
  parsedData: ParsedCVData;
}> {
  await ensureModelsInitialized();

  // Get session
  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) {
    throw new Error('Session not found');
  }

  // Check if CV already exists for this session
  const existingCV = await CV.findOne({ where: { session_id: session.id } });
  if (existingCV) {
    // Delete existing CV to replace
    await existingCV.destroy();
  }

  // Save file
  const filePath = await saveCVFile(session.id, fileBuffer, originalName);

  // Extract text
  let rawText: string;
  if (fileType === 'pdf') {
    rawText = await extractTextFromPDF(fileBuffer);
  } else {
    rawText = fileBuffer.toString('utf-8');
  }

  // Validate text length
  if (rawText.trim().length < 100) {
    throw new Error('CV appears to be empty or too short. Please upload a complete CV.');
  }

  // Parse CV
  const parsedData = await parseCV(rawText);

  // Store in database
  const cv = await CV.create({
    session_id: session.id,
    file_path: filePath,
    raw_text: rawText,
    parsed_data: parsedData,
  });

  // Update session status
  await updateSessionStatus(sessionUuid, 'cv_uploaded');

  return {
    cvId: cv.id,
    parsedData,
  };
}

/**
 * Get parsed CV data for a session
 */
export async function getParsedCV(sessionUuid: string): Promise<ParsedCVData | null> {
  await ensureModelsInitialized();

  const session = await Session.findOne({ where: { uuid: sessionUuid } });
  if (!session) {
    return null;
  }

  const cv = await CV.findOne({ where: { session_id: session.id } });
  if (!cv || !cv.parsed_data) {
    return null;
  }

  return cv.parsed_data;
}

/**
 * Mock parsed CV for development without AI services
 */
function getMockParsedCV(): ParsedCVData {
  return {
    personal: {
      name: 'John Developer',
      email: 'john@example.com',
      phone: '+1 555-0123',
    },
    skills: {
      technical: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
      soft: ['Communication', 'Team Leadership', 'Problem Solving'],
    },
    experience: [
      {
        company: 'Tech Corp',
        role: 'Senior Software Engineer',
        duration_months: 36,
        technologies: ['React', 'Node.js', 'PostgreSQL'],
        achievements: ['Led development of microservices architecture', 'Reduced API response time by 40%'],
      },
    ],
    education: [
      {
        institution: 'State University',
        degree: "Bachelor's",
        field: 'Computer Science',
        year: 2018,
      },
    ],
    projects: [
      {
        name: 'Open Source Dashboard',
        description: 'A real-time analytics dashboard',
        technologies: ['React', 'D3.js'],
        url: 'https://github.com/example/dashboard',
      },
    ],
    inferred_seniority: 'senior',
    total_years_experience: 5,
  };
}
