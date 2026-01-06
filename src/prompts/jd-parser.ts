/**
 * Job Description Parser Prompt Template
 *
 * This prompt instructs the LLM to extract structured information from job descriptions.
 * The output schema matches the ParsedJDData interface in types.
 */

export const JD_PARSER_SYSTEM_PROMPT = `You are an expert HR analyst and job description parser. Your task is to extract structured information from job description text and return it in a specific JSON format.

You must:
1. Distinguish between must-have and nice-to-have requirements
2. Identify competency areas and assign relative weights (must sum to 1.0)
3. Infer seniority level from requirements and language
4. Extract both explicit and implicit requirements
5. Identify soft skills and cultural fit indicators

You must NOT:
1. Make up requirements not in the job description
2. Assume industry-standard requirements unless mentioned
3. Add company information not present in the text`;

export function buildJDParserPrompt(jdText: string): string {
  return `Parse the following job description and extract structured information.

JOB DESCRIPTION:
---
${jdText}
---

Return a JSON object with this exact structure:
{
  "title": "Job title",
  "company": "Company name or null if not mentioned",
  "requirements": {
    "must_have": ["Required skills and qualifications"],
    "nice_to_have": ["Preferred but not required skills"],
    "experience_years": {
      "min": 3,
      "max": 7
    }
  },
  "responsibilities": ["Key job responsibilities"],
  "soft_skills": ["Required soft skills"],
  "inferred_seniority": "One of: junior, mid, mid-senior, senior, lead, principal",
  "competency_areas": [
    {
      "name": "Competency category name (e.g., Frontend, Backend, DevOps)",
      "weight": 0.3,
      "skills": ["Specific skills in this category"]
    }
  ]
}

Guidelines for competency_areas:
- Identify 3-5 main competency areas for the role
- Weights should sum to 1.0 (e.g., 0.3, 0.3, 0.2, 0.2)
- Weight based on emphasis in the job description
- Common areas: Frontend, Backend, DevOps, Database, Mobile, System Design, Soft Skills, etc.

Guidelines for seniority inference:
- junior: mentions "entry-level", "graduate", "0-2 years"
- mid: mentions "2-4 years", standard developer requirements
- mid-senior: mentions "4-6 years", some leadership
- senior: mentions "senior", "5+ years", technical leadership
- lead: mentions "lead", "architect", team management
- principal: mentions "principal", "staff", "distinguished"

If experience years aren't specified, infer from seniority level:
- junior: min 0, max 2
- mid: min 2, max 4
- mid-senior: min 4, max 6
- senior: min 5, max 8
- lead: min 7, max 12
- principal: min 10, max 20

Return ONLY the JSON object, no additional text.`;
}

/**
 * Simplified retry prompt when JSON parsing fails
 */
export function buildJDParserRetryPrompt(jdText: string): string {
  return `Extract information from this job description and return valid JSON only.

JOB DESCRIPTION:
${jdText}

Required JSON structure (return ONLY this JSON, nothing else):
{
  "title": "",
  "company": null,
  "requirements": { "must_have": [], "nice_to_have": [], "experience_years": { "min": 0, "max": 5 } },
  "responsibilities": [],
  "soft_skills": [],
  "inferred_seniority": "mid",
  "competency_areas": []
}

Fill in the values based on the job description. Return valid JSON only.`;
}
