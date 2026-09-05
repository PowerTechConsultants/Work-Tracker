import { Router, Request, Response } from 'express';
import { validate, requireUuid } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { apiCache } from '../../middleware/api-cache';
import { AppError } from '../../lib/app-error';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { createLeaveSchema, listLeavesSchema, reviewLeaveSchema } from './leaves.schema';
import { LeavesService } from './leaves.service';

const router = Router();

router.use(authenticate);

router.get('/balance', apiCache({ ttl: 60_000 }), async (req: Request, res: Response, next) => {
  try {
    const targetId = (req.query.userId as string) || req.user!.sub;
    if (targetId !== req.user!.sub && req.user!.role !== 'director' && req.user!.role !== 'hr') {
      throw new AppError(403, 'Forbidden');
    }
    const rawYear = parseInt(req.query.year as string, 10);
    const year = req.query.year && !isNaN(rawYear) ? Math.min(2100, Math.max(2000, rawYear)) : undefined;
    const balance = await LeavesService.getBalance(targetId, year);
    res.json(balance);
  } catch (err) { next(err); }
});

router.get('/', validate(listLeavesSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const result = await LeavesService.list(req.query as any, req.user!.sub, req.user!.role);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id', requireUuid('id'), async (req: Request, res: Response, next) => {
  try {
    const leave = await LeavesService.getById(req.params.id!, req.user!.sub, req.user!.role);
    res.json(leave);
  } catch (err) { next(err); }
});

router.post('/', validate(createLeaveSchema), async (req: Request, res: Response, next) => {
  try {
    const leave = await LeavesService.create(req.user!.sub, req.body, req.user!.role);
    try { await ActivityLogsService.create(req.user!.sub, 'apply', 'leave', leave.id, { type: leave.type, startDate: leave.startDate, endDate: leave.endDate }, req.ip); } catch (e) { console.error('[ActivityLogs] Failed:', e); }
    res.status(201).json(leave);
  } catch (err) { next(err); }
});

router.post('/:id/review', requireRole('director', 'hr'), requireUuid('id'), validate(reviewLeaveSchema), async (req: Request, res: Response, next) => {
  try {
    const leave = await LeavesService.review(req.params.id!, req.user!.sub, req.body.status, req.body.reviewComment, req.user!.role);
    try { await ActivityLogsService.create(req.user!.sub, 'review', 'leave', leave.id, { status: leave.status }, req.ip); } catch (e) { console.error('[ActivityLogs] Failed:', e); }
    res.json(leave);
  } catch (err) { next(err); }
});

router.post('/:id/cancel', requireUuid('id'), async (req: Request, res: Response, next) => {
  try {
    const leave = await LeavesService.cancel(req.params.id!, req.user!.sub, req.user!.role);
    res.json(leave);
  } catch (err) { next(err); }
});

export default router;
