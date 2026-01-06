import { getSequelize } from '../connection';
import Session, { initSession } from './Session';
import CV, { initCV } from './CV';
import JobDescription, { initJobDescription } from './JobDescription';
import MatchScore, { initMatchScore } from './MatchScore';
import Interview, { initInterview } from './Interview';
import Question, { initQuestion } from './Question';
import Answer, { initAnswer } from './Answer';
import Summary, { initSummary } from './Summary';

// Flag to track initialization
let initialized = false;

// Initialize all models and set up associations
export async function initializeModels(): Promise<void> {
  if (initialized) {
    return;
  }

  // Initialize models in dependency order
  initSession();
  initCV();
  initJobDescription();
  initMatchScore();
  initInterview();
  initQuestion();
  initAnswer();
  initSummary();

  // Set up associations
  setupAssociations();

  initialized = true;
}

function setupAssociations(): void {
  // Session associations
  Session.hasOne(CV, {
    foreignKey: 'session_id',
    as: 'cv',
    onDelete: 'CASCADE',
  });
  Session.hasOne(JobDescription, {
    foreignKey: 'session_id',
    as: 'job_description',
    onDelete: 'CASCADE',
  });
  Session.hasOne(MatchScore, {
    foreignKey: 'session_id',
    as: 'match_score',
    onDelete: 'CASCADE',
  });
  Session.hasMany(Interview, {
    foreignKey: 'session_id',
    as: 'interviews',
    onDelete: 'CASCADE',
  });

  // CV association
  CV.belongsTo(Session, {
    foreignKey: 'session_id',
    as: 'session',
  });

  // JobDescription association
  JobDescription.belongsTo(Session, {
    foreignKey: 'session_id',
    as: 'session',
  });

  // MatchScore association
  MatchScore.belongsTo(Session, {
    foreignKey: 'session_id',
    as: 'session',
  });

  // Interview associations
  Interview.belongsTo(Session, {
    foreignKey: 'session_id',
    as: 'session',
  });
  Interview.hasMany(Question, {
    foreignKey: 'interview_id',
    as: 'questions',
    onDelete: 'CASCADE',
  });
  Interview.hasOne(Summary, {
    foreignKey: 'interview_id',
    as: 'summary',
    onDelete: 'CASCADE',
  });

  // Question associations
  Question.belongsTo(Interview, {
    foreignKey: 'interview_id',
    as: 'interview',
  });
  Question.hasOne(Answer, {
    foreignKey: 'question_id',
    as: 'answer',
    onDelete: 'CASCADE',
  });
  // Self-referential for follow-up chains
  Question.belongsTo(Question, {
    foreignKey: 'parent_id',
    as: 'parent',
  });
  Question.hasMany(Question, {
    foreignKey: 'parent_id',
    as: 'follow_ups',
    onDelete: 'CASCADE',
  });

  // Answer association
  Answer.belongsTo(Question, {
    foreignKey: 'question_id',
    as: 'question',
  });

  // Summary association
  Summary.belongsTo(Interview, {
    foreignKey: 'interview_id',
    as: 'interview',
  });
}

// Sync database (create tables)
export async function syncDatabase(force = false): Promise<void> {
  await initializeModels();
  const sequelize = getSequelize();
  await sequelize.sync({ force });
}

// Export all models
export {
  Session,
  CV,
  JobDescription,
  MatchScore,
  Interview,
  Question,
  Answer,
  Summary,
};

// Export model types
export type { default as SessionModel } from './Session';
export type { default as CVModel } from './CV';
export type { default as JobDescriptionModel } from './JobDescription';
export type { default as MatchScoreModel } from './MatchScore';
export type { default as InterviewModel } from './Interview';
export type { default as QuestionModel } from './Question';
export type { default as AnswerModel } from './Answer';
export type { default as SummaryModel } from './Summary';
