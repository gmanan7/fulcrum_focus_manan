import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth.js';
import DepartmentService from '../services/DepartmentService.js';

const router = Router();

router.use(authMiddleware);

router.get('/factories', async (_req: AuthenticatedRequest, res: Response, next) => {
  try {
    const factories = await DepartmentService.getFactories();
    res.json(factories);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const factoryId = req.query.factoryId as string | undefined;
    const departments = await DepartmentService.getDepartments(factoryId);
    res.json(departments);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('super_admin', 'factory_manager'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { factory_id, name, code, display_order } = req.body;
    const newDept = await DepartmentService.createDepartment(factory_id, name, code, display_order);
    res.status(201).json(newDept);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('super_admin', 'factory_manager'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await DepartmentService.updateDepartment(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
