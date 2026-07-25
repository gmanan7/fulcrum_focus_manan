import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import logger from './config/logger.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import departmentsRouter from './routes/departments.js';
import kpiRouter from './routes/kpi.js';
import tasksRouter from './routes/tasks.js';
import meetingsRouter from './routes/meetings.js';
import projectsRouter from './routes/projects.js';
import pdRouter from './routes/pd.js';
import pmRouter from './routes/pm.js';
import auditRouter from './routes/audit.js';

const app = express();

// Security & Utility Middleware
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(globalLimiter);

// Health Check Endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/kpi', kpiRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/pd-jobs', pdRouter);
app.use('/api/pm', pmRouter);
app.use('/api/audit-logs', auditRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Centralized Error Handler
app.use(errorHandler);

const PORT = env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`🚀 Fulcrum Focus Express Backend server running on http://localhost:${PORT}`);
});

export default app;
