import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middleware/auth.js';
import KPIService from '../services/KPIService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const departmentId = req.query.departmentId as string | undefined;
    const kpis = await KPIService.getKPIs(departmentId);
    res.json(kpis);
  } catch (error) {
    next(error);
  }
});

router.get('/charts', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const departmentId = req.query.departmentId as string | undefined;
    const charts = await KPIService.getKPICharts(departmentId);
    res.json(charts);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const kpi = await KPIService.getKPIById(req.params.id);
    res.json(kpi);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('super_admin', 'factory_manager', 'department_head'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const newKpi = await KPIService.createKPI(req.body);
    res.status(201).json(newKpi);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('super_admin', 'factory_manager', 'department_head'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await KPIService.updateKPI(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('super_admin', 'factory_manager'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await KPIService.deleteKPI(req.params.id);
    res.json({ success: true, message: 'KPI deactivated' });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/entries', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const entries = await KPIService.getEntries(req.params.id, startDate, endDate);
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

router.post('/entries', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const entry = await KPIService.submitEntry({
      ...req.body,
      entered_by: req.userId,
    });
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

export default router;
