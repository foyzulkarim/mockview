import { DataTypes, Model, Optional } from 'sequelize';
import { getSequelize } from '../connection';

// Question attributes
interface QuestionAttributes {
  id: number;
  interview_id: number;
  parent_id: number | null; // Self-reference for follow-up chains
  sequence_num: number;
  competency: string;
  question_text: string;
  audio_path: string | null;
  depth_level: number; // 0 for root, 1+ for follow-ups
  created_at: Date;
  updated_at: Date;
}

// Attributes for creation
interface QuestionCreationAttributes extends Optional<QuestionAttributes, 'id' | 'parent_id' | 'audio_path' | 'depth_level' | 'created_at' | 'updated_at'> {}

class Question extends Model<QuestionAttributes, QuestionCreationAttributes> implements QuestionAttributes {
  declare id: number;
  declare interview_id: number;
  declare parent_id: number | null;
  declare sequence_num: number;
  declare competency: string;
  declare question_text: string;
  declare audio_path: string | null;
  declare depth_level: number;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare readonly interview?: import('./Interview').default;
  declare readonly answer?: import('./Answer').default;
  declare readonly parent?: Question;
  declare readonly follow_ups?: Question[];
}

export function initQuestion() {
  Question.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      interview_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'interviews',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      parent_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'questions',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      sequence_num: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      competency: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      question_text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      audio_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      depth_level: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize: getSequelize(),
      tableName: 'questions',
      modelName: 'Question',
      indexes: [
        { fields: ['interview_id', 'sequence_num'] },
        { fields: ['parent_id'] },
        { fields: ['competency'] },
      ],
    }
  );

  return Question;
}

export default Question;
