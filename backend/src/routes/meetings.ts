import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import MeetingService from '../services/MeetingService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const departmentId = req.query.departmentId as string | undefined;
    const date = req.query.date as string | undefined;
    const meetings = await MeetingService.getMeetings(departmentId, date);
    res.json(meetings);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const meeting = await MeetingService.getMeetingById(req.params.id);
    res.json(meeting);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const newMeeting = await MeetingService.createMeeting({
      ...req.body,
      created_by: req.userId,
    });
    res.status(201).json(newMeeting);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const updated = await MeetingService.updateMeeting(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/attendees', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const attendees = await MeetingService.getAttendees(req.params.id);
    res.json(attendees);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/decisions', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const decisions = await MeetingService.getDecisions(req.params.id);
    res.json(decisions);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/decisions', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { decisionText } = req.body;
    if (!decisionText) {
      res.status(400).json({ error: 'decisionText is required' });
      return;
    }
    const decision = await MeetingService.createDecision(req.params.id, decisionText);
    res.status(201).json(decision);
  } catch (error) {
    next(error);
  }
});

export default router;
