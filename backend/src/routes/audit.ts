import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth.js';
import AuditService from '../services/AuditService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole('super_admin', 'factory_manager'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const tableName = req.query.tableName as string | undefined;
    const action = req.query.action as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const logs = await AuditService.getAuditLogs(tableName, action, limit);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

export default router;
