import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import AuthService from '../services/AuthService.js';

const router = Router();

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const result = await AuthService.login(email, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { fullName, email, password, employeeId, designation } = req.body;
    if (!fullName || !email || !password) {
      res.status(400).json({ error: 'Full name, email, and password required' });
      return;
    }

    const result = await AuthService.register(fullName, email, password, employeeId, designation);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const profile = await AuthService.getUserProfile(req.userId!);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: 'Old and new passwords required' });
      return;
    }

    const result = await AuthService.changePassword(req.userId!, oldPassword, newPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/roles', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const roles = await AuthService.getUserRoles(req.userId!);
    res.json({ roles });
  } catch (error) {
    next(error);
  }
});

export default router;
