/**
 * Summary Generator Prompts
 * Generate comprehensive interview performance summaries
 */

export const SUMMARY_GENERATOR_SYSTEM_PROMPT = `You are an expert interview coach and career advisor. Your role is to provide constructive, actionable feedback on mock interview performances.

Guidelines:
- Be encouraging but honest about areas for improvement
- Focus on specific, actionable advice
- Consider both technical competency and communication skills
- Relate feedback to the specific job requirements
- Provide concrete examples from the interview when giving feedback
- Structure feedback clearly with sections for strengths, improvements, and next steps

Output must be valid JSON matching the expected schema.`;

export function buildSummaryPrompt(
  interviewData: {
    jobTitle: string;
    company?: string;
    duration_minutes: number;
    questions_answered: number;
    competencies_covered: string[];
  },
  questionsAndAnswers: Array<{
    question: string;
    answer: string;
    competency: string;
    score: number;
    reasoning: string;
  }>,
  matchData: {
    overall_score: number;
    strengths: string[];
    gaps: string[];
  }
): string {
  const qaSection = questionsAndAnswers
    .map(
      (qa, i) => `
Question ${i + 1} (${qa.competency}):
Q: "${qa.question}"
A: "${qa.answer}"
Score: ${qa.score}/5
Evaluation: ${qa.reasoning}
`
    )
    .join('\n');

  return `Generate a comprehensive interview performance summary.

## Job Context
- Position: ${interviewData.jobTitle}${interviewData.company ? ` at ${interviewData.company}` : ''}
- Initial Match Score: ${matchData.overall_score}%
- Known Strengths: ${matchData.strengths.join(', ')}
- Known Gaps: ${matchData.gaps.join(', ')}

## Interview Stats
- Duration: ${interviewData.duration_minutes} minutes
- Questions Answered: ${interviewData.questions_answered}
- Competencies Covered: ${interviewData.competencies_covered.join(', ')}

## Questions & Answers
${qaSection}

Based on the interview performance, generate a JSON summary with:
{
  "overall_rating": "excellent" | "good" | "satisfactory" | "needs_improvement",
  "overall_score": <1-100 percentage>,
  "executive_summary": "<2-3 sentence high-level assessment>",
  "strengths": [
    {
      "area": "<competency or skill area>",
      "evidence": "<specific example from interview>",
      "impact": "<why this matters for the role>"
    }
  ],
  "areas_for_improvement": [
    {
      "area": "<competency or skill area>",
      "issue": "<what was lacking>",
      "suggestion": "<specific actionable advice>",
      "resources": ["<optional learning resources>"]
    }
  ],
  "competency_scores": {
    "<competency_name>": {
      "score": <1-5>,
      "summary": "<brief assessment>"
    }
  },
  "communication_feedback": {
    "clarity": <1-5>,
    "structure": <1-5>,
    "confidence": <1-5>,
    "examples_usage": <1-5>,
    "notes": "<specific observations>"
  },
  "recommended_next_steps": [
    "<actionable preparation step>"
  ],
  "sample_improved_answers": [
    {
      "question": "<original question>",
      "improved_answer": "<model answer demonstrating best practices>"
    }
  ]
}

Focus on being specific and actionable. Reference actual responses where possible.`;
}

export function buildQuickSummaryPrompt(
  questionsAndAnswers: Array<{
    question: string;
    answer: string;
    score: number;
  }>
): string {
  const avgScore =
    questionsAndAnswers.reduce((sum, qa) => sum + qa.score, 0) /
    questionsAndAnswers.length;

  const qaSection = questionsAndAnswers
    .map((qa, i) => `Q${i + 1}: Score ${qa.score}/5`)
    .join(', ');

  return `Generate a brief interview summary.

Average Score: ${avgScore.toFixed(1)}/5
Question Scores: ${qaSection}

Generate a JSON object:
{
  "overall_rating": "excellent" | "good" | "satisfactory" | "needs_improvement",
  "overall_score": <percentage 1-100>,
  "one_liner": "<one sentence assessment>",
  "top_strength": "<single most notable strength>",
  "key_improvement": "<single most important area to work on>",
  "ready_for_interview": <true if score >= 70, false otherwise>
}`;
}
