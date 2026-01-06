/**
 * CV Parser Prompt Template
 *
 * This prompt instructs the LLM to extract structured information from CV text.
 * The output schema matches the ParsedCVData interface in types.
 */

export const CV_PARSER_SYSTEM_PROMPT = `You are an expert HR analyst and CV parser. Your task is to extract structured information from CV/resume text and return it in a specific JSON format.

You must:
1. Extract all relevant information accurately
2. Infer seniority level from job titles, responsibilities, and experience duration
3. Handle missing sections gracefully (use empty arrays or null)
4. Estimate experience durations when not explicitly stated
5. Distinguish between technical and soft skills
6. Extract achievements and quantifiable results when mentioned

You must NOT:
1. Make up information that isn't in the CV
2. Add skills that aren't mentioned or clearly implied
3. Guess contact information`;

export function buildCVParserPrompt(cvText: string): string {
  return `Parse the following CV/resume and extract structured information.

CV TEXT:
---
${cvText}
---

Return a JSON object with this exact structure:
{
  "personal": {
    "name": "Full name or null if not found",
    "email": "Email address or null",
    "phone": "Phone number or null"
  },
  "skills": {
    "technical": ["Array of technical skills, programming languages, frameworks, tools"],
    "soft": ["Array of soft skills like communication, leadership, etc."]
  },
  "experience": [
    {
      "company": "Company name",
      "role": "Job title",
      "duration_months": 12,
      "technologies": ["Technologies used in this role"],
      "achievements": ["Key achievements or responsibilities"]
    }
  ],
  "education": [
    {
      "institution": "School/University name",
      "degree": "Degree type (Bachelor's, Master's, etc.)",
      "field": "Field of study",
      "year": 2020
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "description": "Brief description",
      "technologies": ["Technologies used"],
      "url": "URL if available or null"
    }
  ],
  "inferred_seniority": "One of: junior, mid, mid-senior, senior, lead, principal",
  "total_years_experience": 5
}

Guidelines for seniority inference:
- junior: 0-2 years, entry-level titles
- mid: 2-4 years, standard developer/engineer titles
- mid-senior: 4-6 years, some leadership or senior in title
- senior: 6-10 years, senior titles, technical leadership
- lead: 8-12+ years, team lead, tech lead, architect titles
- principal: 12+ years, principal, staff, distinguished titles

Calculate total_years_experience by summing up all work experience durations.

Return ONLY the JSON object, no additional text.`;
}

/**
 * Simplified retry prompt when JSON parsing fails
 */
export function buildCVParserRetryPrompt(cvText: string): string {
  return `Extract information from this CV and return valid JSON only.

CV TEXT:
${cvText}

Required JSON structure (return ONLY this JSON, nothing else):
{
  "personal": { "name": null, "email": null, "phone": null },
  "skills": { "technical": [], "soft": [] },
  "experience": [],
  "education": [],
  "projects": [],
  "inferred_seniority": "mid",
  "total_years_experience": 0
}

Fill in the values based on the CV. Return valid JSON only.`;
}
