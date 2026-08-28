import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { apiCache } from '../../middleware/api-cache';
import { AnalyticsService } from './analytics.service';

const router = Router();

router.use(authenticate);
router.use(requireRole('director', 'hr'));

router.get('/attendance-trends', apiCache({ ttl: 120_000 }), async (req: Request, res: Response, next) => {
  try {
    const year = Math.min(2100, Math.max(2000, Number(req.query.year) || new Date().getFullYear()));
    const month = Math.min(12, Math.max(1, Number(req.query.month) || (new Date().getMonth() + 1)));
    const data = await AnalyticsService.attendanceTrends(year, month);
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/department-stats', apiCache({ ttl: 120_000 }), async (_req: Request, res: Response, next) => {
  try {
    const data = await AnalyticsService.departmentStats();
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/leave-usage', apiCache({ ttl: 120_000 }), async (req: Request, res: Response, next) => {
  try {
    const year = Math.min(2100, Math.max(2000, Number(req.query.year) || new Date().getFullYear()));
    const data = await AnalyticsService.leaveUsage(year);
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/task-summary', apiCache({ ttl: 120_000 }), async (_req: Request, res: Response, next) => {
  try {
    const data = await AnalyticsService.taskSummary();
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/overtime', apiCache({ ttl: 120_000 }), async (req: Request, res: Response, next) => {
  try {
    const year = Math.min(2100, Math.max(2000, Number(req.query.year) || new Date().getFullYear()));
    const data = await AnalyticsService.overtimeAnalytics(year);
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
