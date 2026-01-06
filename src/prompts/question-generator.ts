/**
 * Question Generator Prompt Templates
 *
 * These prompts instruct the LLM to generate interview questions
 * based on competency areas, CV context, and previous responses.
 */

import type { ParsedCVData, ParsedJDData, CompetencyArea } from '@/lib/types';

export const QUESTION_GENERATOR_SYSTEM_PROMPT = `You are a senior technical interviewer at a leading tech company. Your task is to generate thoughtful interview questions that assess candidates effectively.

You must:
1. Create open-ended questions that reveal depth of knowledge
2. Reference the candidate's specific experience when possible
3. Match question difficulty to the role's seniority level
4. Use behavioral (STAR format) questions for soft skills
5. Focus on real-world scenarios and problem-solving

You must NOT:
1. Ask yes/no questions
2. Ask trivia or factual recall questions
3. Reference skills not mentioned in the CV or JD
4. Be condescending or overly challenging`;

export function buildInitialQuestionPrompt(
  cvData: ParsedCVData,
  jdData: ParsedJDData,
  competency: CompetencyArea,
  questionNumber: number
): string {
  const cvExperience = cvData.experience?.slice(0, 2)
    .map(e => `${e.role} at ${e.company}`)
    .join(', ') || 'their background';

  const cvSkills = cvData.skills?.technical?.slice(0, 5).join(', ') || 'technical skills';

  return `Generate an interview question for a ${jdData.inferred_seniority} level ${jdData.title} candidate.

CANDIDATE BACKGROUND:
- Experience: ${cvExperience}
- Key Skills: ${cvSkills}
- Years of Experience: ${cvData.total_years_experience}

COMPETENCY TO ASSESS: ${competency.name}
- Skills in this area: ${competency.skills.join(', ')}
- Weight: ${Math.round(competency.weight * 100)}% of the role

This is question ${questionNumber} of the interview.

Return a JSON object with this exact structure:
{
  "question_text": "Your interview question here. It should be open-ended, reference the candidate's experience where relevant, and assess the specific competency.",
  "competency": "${competency.name}",
  "expected_topics": ["topic1", "topic2", "topic3"],
  "difficulty": "appropriate|challenging",
  "type": "technical|behavioral|scenario"
}

Guidelines:
- For technical questions: Focus on design decisions, trade-offs, problem-solving
- For behavioral questions: Use STAR format ("Tell me about a time when...")
- Reference specific items from the candidate's CV when relevant

Return ONLY the JSON object, no additional text.`;
}

export function buildFollowUpQuestionPrompt(
  previousQuestion: string,
  previousAnswer: string,
  evaluationReasoning: string,
  competency: string,
  followUpType: 'clarify' | 'probe',
  depth: number
): string {
  const instructions = followUpType === 'clarify'
    ? 'Ask for clarification or a specific example. The previous answer was vague or incomplete.'
    : 'Probe deeper into the topic. The previous answer was adequate but we want to explore further.';

  return `Generate a follow-up interview question.

PREVIOUS QUESTION:
${previousQuestion}

CANDIDATE'S ANSWER:
${previousAnswer}

EVALUATION:
${evaluationReasoning}

FOLLOW-UP TYPE: ${followUpType}
${instructions}

COMPETENCY: ${competency}
CURRENT DEPTH: ${depth} (deeper questions should be more specific)

Return a JSON object with this exact structure:
{
  "question_text": "Your follow-up question here. It should directly relate to the previous answer and dig deeper into the topic.",
  "competency": "${competency}",
  "expected_topics": ["topic1", "topic2"],
  "type": "follow_up",
  "follow_up_type": "${followUpType}"
}

Guidelines for follow-up questions:
- CLARIFY: "Could you give me a specific example of...", "Walk me through the steps...", "What do you mean by..."
- PROBE: "How would you handle it differently?", "What were the trade-offs?", "How did you measure success?"

Return ONLY the JSON object, no additional text.`;
}

export function buildTransitionPrompt(
  previousCompetency: string,
  nextCompetency: string,
  cvData: ParsedCVData
): string {
  return `Generate a transitional phrase and new question to move from one competency area to another.

PREVIOUS COMPETENCY: ${previousCompetency}
NEXT COMPETENCY: ${nextCompetency}

CANDIDATE SKILLS IN ${nextCompetency.toUpperCase()}:
${cvData.skills?.technical?.filter(s =>
  s.toLowerCase().includes(nextCompetency.toLowerCase())
).join(', ') || 'general skills'}

Return a JSON object:
{
  "transition": "A natural transition phrase like 'Great, let's shift gears and talk about...'",
  "question_text": "The first question for the new competency area",
  "competency": "${nextCompetency}",
  "expected_topics": ["topic1", "topic2"],
  "type": "technical|behavioral"
}

Return ONLY the JSON object.`;
}
