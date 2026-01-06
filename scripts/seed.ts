/**
 * Database seed script for MockView
 *
 * This script populates the database with sample data for testing and development.
 * Run with: npx ts-node scripts/seed.ts
 *
 * Note: This will clear existing data! Use with caution.
 */

import { v4 as uuidv4 } from 'uuid';
import { syncDatabase, Session, CV, JobDescription, MatchScore, Interview, Question, Answer, Summary } from '../src/lib/db/models';
import { getSequelize } from '../src/lib/db/connection';
import { config } from '../src/lib/config';
import type { ParsedCVData, ParsedJDData, MatchBreakdown, QuestionPlan, InterviewState, AnswerEvaluation, CompetencyScore } from '../src/lib/types';

// Sample parsed CV data
const sampleParsedCV: ParsedCVData = {
  personal: {
    name: 'John Developer',
    email: 'john@example.com',
    phone: '+1 555-0123',
  },
  skills: {
    technical: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'GraphQL', 'Git'],
    soft: ['Communication', 'Team Leadership', 'Problem Solving', 'Agile Methodologies'],
  },
  experience: [
    {
      company: 'Tech Corp',
      role: 'Senior Software Engineer',
      duration_months: 36,
      technologies: ['React', 'Node.js', 'PostgreSQL', 'AWS'],
      achievements: [
        'Led development of microservices architecture serving 1M+ users',
        'Reduced API response time by 40% through optimization',
        'Mentored team of 5 junior developers',
      ],
    },
    {
      company: 'StartupXYZ',
      role: 'Full Stack Developer',
      duration_months: 24,
      technologies: ['React', 'Express', 'MongoDB'],
      achievements: [
        'Built MVP that secured $2M seed funding',
        'Implemented real-time collaboration features',
      ],
    },
  ],
  education: [
    {
      institution: 'State University',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      year: 2018,
    },
  ],
  projects: [
    {
      name: 'Open Source Dashboard',
      description: 'A real-time analytics dashboard with customizable widgets',
      technologies: ['React', 'D3.js', 'WebSockets'],
      url: 'https://github.com/example/dashboard',
    },
  ],
  inferred_seniority: 'senior',
  total_years_experience: 5,
};

// Sample parsed JD data
const sampleParsedJD: ParsedJDData = {
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
    'Collaborate with product team on feature requirements',
  ],
  soft_skills: ['Communication', 'Leadership', 'Problem Solving'],
  inferred_seniority: 'senior',
  competency_areas: [
    { name: 'Frontend', weight: 0.3, skills: ['React', 'TypeScript', 'CSS', 'State Management'] },
    { name: 'Backend', weight: 0.35, skills: ['Node.js', 'APIs', 'Databases', 'Authentication'] },
    { name: 'DevOps', weight: 0.15, skills: ['Docker', 'CI/CD', 'Cloud Services'] },
    { name: 'Soft Skills', weight: 0.2, skills: ['Communication', 'Leadership', 'Collaboration'] },
  ],
};

// Sample match breakdown
const sampleMatchBreakdown: MatchBreakdown = {
  technical_skills: {
    score: 78,
    matched: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker'],
    missing: ['Kubernetes'],
  },
  experience_level: {
    score: 85,
    cv_level: 'senior',
    jd_level: 'senior',
    assessment: 'Strong alignment with required experience level',
  },
  required_technologies: {
    score: 90,
    matched: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
    missing: [],
  },
  soft_skills: {
    score: 95,
    matched: ['Communication', 'Leadership', 'Problem Solving'],
    assessment: 'Excellent soft skill alignment',
  },
  strengths: [
    'Strong React and Node.js experience',
    'Leadership experience matches senior expectations',
    'Relevant project portfolio',
    'Good track record of measurable achievements',
  ],
  gaps: [
    'Limited Kubernetes exposure (nice-to-have)',
    'No explicit experience with company\'s industry',
  ],
};

// Sample question plan
const sampleQuestionPlan: QuestionPlan = {
  competencies: [
    { name: 'Frontend', weight: 0.3, planned_questions: 2, skills_to_cover: ['React', 'State Management'] },
    { name: 'Backend', weight: 0.35, planned_questions: 3, skills_to_cover: ['Node.js', 'APIs', 'Database Design'] },
    { name: 'DevOps', weight: 0.15, planned_questions: 1, skills_to_cover: ['Docker', 'CI/CD'] },
    { name: 'Soft Skills', weight: 0.2, planned_questions: 2, skills_to_cover: ['Leadership', 'Communication'] },
  ],
  total_planned_questions: 8,
  estimated_duration_minutes: 35,
};

// Sample interview state
const sampleInterviewState: InterviewState = {
  competencies: {
    'Frontend': { status: 'completed', questions_asked: 2, current_depth: 0, avg_score: 4.5 },
    'Backend': { status: 'completed', questions_asked: 3, current_depth: 0, avg_score: 4.0 },
    'DevOps': { status: 'completed', questions_asked: 1, current_depth: 0, avg_score: 3.5 },
    'Soft Skills': { status: 'completed', questions_asked: 2, current_depth: 0, avg_score: 4.8 },
  },
  total_questions: 8,
  estimated_remaining: 0,
  current_competency: 'Soft Skills',
};

// Sample evaluation
const sampleEvaluation: AnswerEvaluation = {
  relevance: 4,
  depth: 4,
  accuracy: 5,
  examples: 3,
  communication: 4,
  reasoning: 'Good technical explanation with clear examples. Could provide more specific metrics.',
  overall_score: 4,
  suggested_follow_up: undefined,
};

// Sample competency scores
const sampleCompetencyScores: CompetencyScore[] = [
  { name: 'Frontend', score: 85, assessment: 'excellent', feedback: 'Strong understanding of React patterns and state management.' },
  { name: 'Backend', score: 78, assessment: 'good', feedback: 'Solid API design knowledge, could improve on database optimization.' },
  { name: 'DevOps', score: 65, assessment: 'good', feedback: 'Basic Docker understanding, room to grow in cloud services.' },
  { name: 'Soft Skills', score: 92, assessment: 'excellent', feedback: 'Exceptional communication and leadership examples.' },
];

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Sync database (this creates tables if they don't exist)
    console.log('📊 Syncing database schema...');
    await syncDatabase(true); // force: true will drop and recreate tables
    console.log('✅ Database schema synced\n');

    // Create a sample session
    console.log('📝 Creating sample session...');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.session.expiryHours);

    const session = await Session.create({
      uuid: uuidv4(),
      status: 'completed',
      expires_at: expiresAt,
    });
    console.log(`✅ Session created: ${session.uuid}\n`);

    // Create CV record
    console.log('📄 Creating CV record...');
    const cv = await CV.create({
      session_id: session.id,
      raw_text: 'John Developer\nSenior Software Engineer\n\nSkills: TypeScript, React, Node.js...',
      parsed_data: sampleParsedCV,
    });
    console.log(`✅ CV created: ID ${cv.id}\n`);

    // Create Job Description record
    console.log('📋 Creating Job Description record...');
    const jd = await JobDescription.create({
      session_id: session.id,
      raw_text: 'Senior Full Stack Engineer at Innovative Tech...',
      parsed_data: sampleParsedJD,
    });
    console.log(`✅ Job Description created: ID ${jd.id}\n`);

    // Create Match Score record
    console.log('🎯 Creating Match Score record...');
    const matchScore = await MatchScore.create({
      session_id: session.id,
      overall_score: 82,
      breakdown: sampleMatchBreakdown,
    });
    console.log(`✅ Match Score created: ${matchScore.overall_score}%\n`);

    // Create Interview record
    console.log('🎤 Creating Interview record...');
    const interview = await Interview.create({
      session_id: session.id,
      status: 'completed',
      question_plan: sampleQuestionPlan,
      interview_state: sampleInterviewState,
      started_at: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
      completed_at: new Date(),
    });
    console.log(`✅ Interview created: ID ${interview.id}\n`);

    // Create sample questions and answers
    console.log('❓ Creating sample questions and answers...');
    const questions = [
      {
        competency: 'Frontend',
        text: 'I see you built a real-time notification system at Tech Corp. Can you walk me through your approach to state management in that project?',
        depth: 0,
      },
      {
        competency: 'Frontend',
        text: 'How did you handle optimistic updates in the UI when dealing with real-time data?',
        depth: 1,
      },
      {
        competency: 'Backend',
        text: 'Tell me about a time when you had to optimize a slow API endpoint. What was your approach?',
        depth: 0,
      },
      {
        competency: 'DevOps',
        text: 'How have you used Docker in your development workflow?',
        depth: 0,
      },
      {
        competency: 'Soft Skills',
        text: 'You mentioned mentoring 5 junior developers. How did you approach that responsibility?',
        depth: 0,
      },
    ];

    let prevQuestionId: number | null = null;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const createdQuestion = await Question.create({
        interview_id: interview.id,
        parent_id: q.depth > 0 ? prevQuestionId : null,
        sequence_num: i + 1,
        competency: q.competency,
        question_text: q.text,
        depth_level: q.depth,
      });
      const questionId: number = createdQuestion.id;

      // Create an answer for this question
      await Answer.create({
        question_id: questionId,
        answer_text: `Sample answer for question ${i + 1}. This would contain the candidate's response about ${q.competency.toLowerCase()}.`,
        response_time_ms: Math.floor(Math.random() * 60000) + 30000, // 30-90 seconds
        evaluation: sampleEvaluation,
        quality_score: Math.floor(Math.random() * 2) + 4, // 4 or 5
      });

      prevQuestionId = questionId;
    }
    console.log(`✅ Created ${questions.length} questions with answers\n`);

    // Create Summary record
    console.log('📊 Creating Summary record...');
    await Summary.create({
      interview_id: interview.id,
      overall_score: 80,
      competency_scores: sampleCompetencyScores,
      strengths: [
        'Clear articulation of complex technical concepts',
        'Strong React architecture understanding',
        'Good use of concrete examples from experience',
        'Demonstrated leadership capabilities',
      ],
      improvements: [
        'Deepen Kubernetes/container orchestration knowledge',
        'Practice explaining database scaling decisions',
        'Prepare more specific metrics for project outcomes',
      ],
      recommendations: [
        'Review Kubernetes basics before the interview',
        'Prepare 2-3 STAR format stories for leadership questions',
        'Have specific numbers ready (performance improvements, team sizes, etc.)',
      ],
      verdict: 'ready',
      verdict_reasoning: 'The candidate demonstrates strong technical fundamentals across frontend and backend development. While there are some gaps in DevOps knowledge, the overall profile shows readiness for a senior engineering role. The communication skills and leadership experience are particularly strong assets.',
    });
    console.log('✅ Summary created\n');

    console.log('🎉 Database seeded successfully!\n');
    console.log('📌 Sample session UUID:', session.uuid);
    console.log('📌 You can use this UUID to test the application\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    // Close database connection
    const sequelize = getSequelize();
    await sequelize.close();
  }
}

// Run the seed
seed().catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});
