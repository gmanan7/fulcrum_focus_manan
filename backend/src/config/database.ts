import pkg from 'pg';
const { Pool } = pkg;
import { env } from './env.js';
import logger from './logger.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (env.NODE_ENV === 'development') {
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    logger.error('Database Query Error:', { text, params, error });
    throw error;
  }
};

export default {
  pool,
  query,
};
