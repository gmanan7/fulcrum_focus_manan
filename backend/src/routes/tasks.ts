import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import TaskService from '../services/TaskService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const filters = {
      departmentId: req.query.departmentId as string | undefined,
      status: req.query.status as string | undefined,
      assigneeId: req.query.assigneeId as string | undefined,
      meetingId: req.query.meetingId as string | undefined,
    };
    const tasks = await TaskService.getAllTasks(filters);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.get('/groups', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const departmentId = req.query.departmentId as string | undefined;
    const groups = await TaskService.getTaskGroups(departmentId);
    res.json(groups);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const task = await TaskService.getTaskById(req.params.id);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const newTask = await TaskService.createTask({
      ...req.body,
      creator_id: req.userId,
    });
    res.status(201).json(newTask);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await TaskService.updateTask(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { status, reason } = req.body;
    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }
    const updated = await TaskService.updateTaskStatus(req.params.id, status, req.userId, reason);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/due-date', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { dueDate, reason } = req.body;
    if (!dueDate) {
      res.status(400).json({ error: 'dueDate is required' });
      return;
    }
    const updated = await TaskService.updateTaskDueDate(req.params.id, dueDate, req.userId, reason);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await TaskService.deleteTask(req.params.id);
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
