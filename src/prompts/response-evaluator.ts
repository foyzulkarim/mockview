/**
 * Response Evaluator Prompt Template
 *
 * This prompt instructs the LLM to evaluate interview responses
 * and determine whether follow-up questions are needed.
 */

export const RESPONSE_EVALUATOR_SYSTEM_PROMPT = `You are an expert interview evaluator. Your task is to assess candidate responses objectively and fairly.

You must:
1. Evaluate responses on multiple dimensions
2. Consider the question context and competency being assessed
3. Give credit for relevant examples and concrete details
4. Assess communication clarity alongside technical accuracy
5. Identify whether follow-up questions are needed

You must NOT:
1. Be overly harsh or generous
2. Focus only on keyword matching
3. Penalize communication style differences
4. Assume knowledge not demonstrated in the answer`;

export function buildResponseEvaluatorPrompt(
  question: string,
  answer: string,
  competency: string,
  expectedTopics: string[]
): string {
  return `Evaluate this interview response.

QUESTION:
${question}

COMPETENCY BEING ASSESSED: ${competency}

EXPECTED TOPICS/THEMES:
${expectedTopics.join(', ')}

CANDIDATE'S ANSWER:
${answer}

Return a JSON object with this exact structure:
{
  "relevance": 4,
  "depth": 3,
  "accuracy": 4,
  "examples": 2,
  "communication": 4,
  "overall_score": 3.4,
  "reasoning": "Brief explanation of the evaluation (2-3 sentences)",
  "suggested_follow_up": "clarify|probe|none",
  "key_points_covered": ["point1", "point2"],
  "missed_opportunities": ["topic they could have expanded on"]
}

Scoring Guide (1-5 scale):
1 - Poor: Irrelevant, incorrect, or completely lacking
2 - Weak: Partially relevant but missing key points, vague
3 - Adequate: Addresses the question but lacks depth or examples
4 - Good: Solid answer with some concrete examples
5 - Excellent: Comprehensive, specific examples, clear communication

For suggested_follow_up:
- "clarify": Score 1-2, answer needs clarification or examples
- "probe": Score 3, answer is okay but could go deeper
- "none": Score 4-5, ready to move on

Calculate overall_score as the average of all dimension scores.

Return ONLY the JSON object, no additional text.`;
}

/**
 * Simplified prompt for retry
 */
export function buildResponseEvaluatorRetryPrompt(
  question: string,
  answer: string
): string {
  return `Rate this interview answer from 1-5.

Question: ${question}

Answer: ${answer}

Return this JSON:
{
  "relevance": 3,
  "depth": 3,
  "accuracy": 3,
  "examples": 3,
  "communication": 3,
  "overall_score": 3,
  "reasoning": "Brief evaluation",
  "suggested_follow_up": "none",
  "key_points_covered": [],
  "missed_opportunities": []
}

Return valid JSON only.`;
}
