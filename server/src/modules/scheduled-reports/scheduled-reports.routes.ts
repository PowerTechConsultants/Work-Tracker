import { Router, Request, Response } from 'express';
import { validate, requireUuid } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { createScheduleSchema, updateScheduleSchema, listSchedulesSchema } from './scheduled-reports.schema';
import { ScheduledReportsService } from './scheduled-reports.service';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('director', 'hr'), validate(listSchedulesSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const result = await ScheduledReportsService.list(req.query as any);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id', requireRole('director', 'hr'), requireUuid('id'), async (req: Request, res: Response, next) => {
  try {
    const schedule = await ScheduledReportsService.getById(req.params.id!);
    res.json(schedule);
  } catch (err) { next(err); }
});

router.post('/', requireRole('director', 'hr'), validate(createScheduleSchema), async (req: Request, res: Response, next) => {
  try {
    const schedule = await ScheduledReportsService.create(req.user!.sub, req.body);
    res.status(201).json(schedule);
  } catch (err) { next(err); }
});

router.patch('/:id', requireRole('director', 'hr'), requireUuid('id'), validate(updateScheduleSchema), async (req: Request, res: Response, next) => {
  try {
    const schedule = await ScheduledReportsService.update(req.params.id!, req.user!.sub, req.body, req.user!.role);
    res.json(schedule);
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('director', 'hr'), requireUuid('id'), async (req: Request, res: Response, next) => {
  try {
    const result = await ScheduledReportsService.delete(req.params.id!, req.user!.sub, req.user!.role);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/run', requireRole('director', 'hr'), requireUuid('id'), async (req: Request, res: Response, next) => {
  try {
    const result = await ScheduledReportsService.runNow(req.params.id!);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id/results', requireRole('director', 'hr'), requireUuid('id'), async (req: Request, res: Response, next) => {
  try {
    const results = await ScheduledReportsService.getResults(req.params.id!);
    res.json(results);
  } catch (err) { next(err); }
});

export default router;
