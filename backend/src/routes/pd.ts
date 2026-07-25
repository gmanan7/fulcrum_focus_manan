import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import PDService from '../services/PDService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const departmentId = req.query.departmentId as string | undefined;
    const stage = req.query.stage as string | undefined;
    const jobs = await PDService.getPDJobs(departmentId, stage);
    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const job = await PDService.getPDJobById(req.params.id);
    res.json(job);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const newJob = await PDService.createPDJob(req.body);
    res.status(201).json(newJob);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/stage', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { stage, notes } = req.body;
    if (!stage) {
      res.status(400).json({ error: 'Stage is required' });
      return;
    }
    const updated = await PDService.updatePDStage(req.params.id, stage, req.userId, notes);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const history = await PDService.getStageHistory(req.params.id);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

export default router;
