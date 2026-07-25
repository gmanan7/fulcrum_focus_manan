import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import PMService from '../services/PMService.js';

const router = Router();

router.use(authMiddleware);

router.get('/machines', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const departmentId = req.query.departmentId as string | undefined;
    const machines = await PMService.getMachines(departmentId);
    res.json(machines);
  } catch (error) {
    next(error);
  }
});

router.post('/machines', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const newMachine = await PMService.createMachine(req.body);
    res.status(201).json(newMachine);
  } catch (error) {
    next(error);
  }
});

router.get('/schedules', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const machineId = req.query.machineId as string | undefined;
    const monthYear = req.query.monthYear as string | undefined;
    const schedules = await PMService.getSchedules(machineId, monthYear);
    res.json(schedules);
  } catch (error) {
    next(error);
  }
});

export default router;
