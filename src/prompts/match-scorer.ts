/**
 * Match Scorer Prompt Template
 *
 * This prompt instructs the LLM to compare parsed CV and JD data
 * and generate a compatibility score with detailed breakdown.
 */

import type { ParsedCVData, ParsedJDData } from '@/lib/types';

export const MATCH_SCORER_SYSTEM_PROMPT = `You are an expert HR analyst and recruiter. Your task is to evaluate how well a candidate's CV matches a job description and provide a detailed compatibility assessment.

You must:
1. Compare skills, experience, and qualifications objectively
2. Consider both must-have and nice-to-have requirements
3. Assess seniority alignment (over/under qualified detection)
4. Identify specific strengths and gaps
5. Provide nuanced scoring that reflects real-world hiring decisions

You must NOT:
1. Be overly generous or harsh in scoring
2. Give high scores just because of superficial keyword matches
3. Ignore soft skills and cultural fit indicators`;

export function buildMatchScorerPrompt(
  cvData: ParsedCVData,
  jdData: ParsedJDData
): string {
  return `Evaluate how well this candidate matches the job requirements.

CANDIDATE CV DATA:
${JSON.stringify(cvData, null, 2)}

JOB REQUIREMENTS:
${JSON.stringify(jdData, null, 2)}

Return a JSON object with this exact structure:
{
  "overall_score": 72,
  "breakdown": {
    "technical_skills": {
      "score": 78,
      "matched": ["skill1", "skill2"],
      "missing": ["skill3"]
    },
    "experience_level": {
      "score": 85,
      "cv_level": "senior",
      "jd_level": "senior",
      "assessment": "Strong alignment with required experience level"
    },
    "required_technologies": {
      "score": 90,
      "matched": ["React", "Node.js"],
      "missing": ["Kubernetes"]
    },
    "soft_skills": {
      "score": 95,
      "matched": ["Communication", "Leadership"],
      "assessment": "Excellent soft skill alignment"
    },
    "strengths": [
      "Specific strength 1",
      "Specific strength 2"
    ],
    "gaps": [
      "Specific gap 1",
      "Specific gap 2"
    ]
  }
}

Scoring guidelines:
- overall_score: 0-100, weighted average of category scores
- technical_skills: Compare CV technical skills against JD must-have requirements
- experience_level: Assess years of experience and seniority alignment
- required_technologies: Match specific technologies mentioned in JD
- soft_skills: Compare soft skills and cultural fit

Score interpretation:
- 80-100: Excellent match, likely to pass screening
- 60-79: Good match, worth interviewing
- 40-59: Moderate match, may have significant gaps
- 20-39: Weak match, missing key requirements
- 0-19: Poor match, not recommended

Provide 3-5 specific strengths and 2-4 specific gaps.
Return ONLY the JSON object, no additional text.`;
}

/**
 * Simplified retry prompt when JSON parsing fails
 */
export function buildMatchScorerRetryPrompt(
  cvData: ParsedCVData,
  jdData: ParsedJDData
): string {
  return `Compare this CV against the job requirements and return a JSON score.

CV SKILLS: ${cvData.skills?.technical?.join(', ') || 'None listed'}
CV EXPERIENCE: ${cvData.total_years_experience} years, ${cvData.inferred_seniority} level

JD REQUIREMENTS: ${jdData.requirements?.must_have?.join(', ') || 'None listed'}
JD EXPERIENCE: ${jdData.requirements?.experience_years?.min}-${jdData.requirements?.experience_years?.max} years, ${jdData.inferred_seniority} level

Return this exact JSON structure with values filled in:
{
  "overall_score": 50,
  "breakdown": {
    "technical_skills": { "score": 50, "matched": [], "missing": [] },
    "experience_level": { "score": 50, "cv_level": "", "jd_level": "", "assessment": "" },
    "required_technologies": { "score": 50, "matched": [], "missing": [] },
    "soft_skills": { "score": 50, "matched": [], "assessment": "" },
    "strengths": [],
    "gaps": []
  }
}

Return valid JSON only.`;
}
