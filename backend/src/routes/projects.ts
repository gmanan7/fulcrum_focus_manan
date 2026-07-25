import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import ProjectService from '../services/ProjectService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const departmentId = req.query.departmentId as string | undefined;
    const projects = await ProjectService.getProjects(departmentId);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const newProject = await ProjectService.createProject(req.body);
    res.status(201).json(newProject);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/items', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const items = await ProjectService.getProjectItems(req.params.id);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/items', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const newItem = await ProjectService.createProjectItem({
      ...req.body,
      project_id: req.params.id,
    });
    res.status(201).json(newItem);
  } catch (error) {
    next(error);
  }
});

router.put('/items/:itemId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await ProjectService.updateProjectItem(req.params.itemId, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
