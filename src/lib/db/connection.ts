import { Sequelize } from 'sequelize';
import { config } from '../config';

// Singleton pattern for database connection
let sequelize: Sequelize | null = null;

export function getSequelize(): Sequelize {
  if (!sequelize) {
    sequelize = new Sequelize(config.database.url, {
      dialect: 'postgres',
      logging: config.dev.debugMode ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      define: {
        timestamps: true,
        underscored: true, // Use snake_case for column names
      },
    });
  }
  return sequelize;
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const db = getSequelize();
    await db.authenticate();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Close database connection (for cleanup)
export async function closeConnection(): Promise<void> {
  if (sequelize) {
    await sequelize.close();
    sequelize = null;
  }
}
