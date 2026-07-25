import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth.js';
import UserService from '../services/UserService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (_req: AuthenticatedRequest, res: Response, next) => {
  try {
    const users = await UserService.getAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = await UserService.getUserById(req.params.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('super_admin', 'factory_manager'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await UserService.updateUser(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/roles', requireRole('super_admin'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles)) {
      res.status(400).json({ error: 'Roles must be an array' });
      return;
    }
    const updatedRoles = await UserService.setUserRoles(req.params.id, roles);
    res.json({ roles: updatedRoles });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/departments', requireRole('super_admin', 'factory_manager'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { departmentIds, primaryDeptId } = req.body;
    await UserService.setUserDepartments(req.params.id, departmentIds || [], primaryDeptId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
