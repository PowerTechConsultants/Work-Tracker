import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { createReportSchema, updateReportSchema, listReportsSchema, reviewReportSchema } from './reports.schema';
import { ReportsService } from './reports.service';

const router = Router();

router.use(authenticate);

router.get('/', validate(listReportsSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const result = await ReportsService.list(req.query as any, req.user!.sub, req.user!.role);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/slots', requireRole('director', 'hr'), async (_req: Request, res: Response, next) => {
  try {
    const slots = await ReportsService.getEmployeeSlots();
    res.json(slots);
  } catch (err) { next(err); }
});

router.get('/export', requireRole('director', 'hr'), async (req: Request, res: Response, next) => {
  try {
    const reports = await ReportsService.exportByUser(req.query.userId as string, req.query.startDate as string, req.query.endDate as string);
    res.json(reports);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const report = await ReportsService.getById(req.params.id!, req.user!.sub, req.user!.role);
    res.json(report);
  } catch (err) { next(err); }
});

router.post('/', validate(createReportSchema), async (req: Request, res: Response, next) => {
  try {
    const report = await ReportsService.create(req.user!.sub, req.body);
    res.status(201).json(report);
  } catch (err) { next(err); }
});

router.patch('/:id', validate(updateReportSchema), async (req: Request, res: Response, next) => {
  try {
    const report = await ReportsService.update(req.params.id!, req.user!.sub, req.body);
    res.json(report);
  } catch (err) { next(err); }
});

router.post('/:id/submit', async (req: Request, res: Response, next) => {
  try {
    const report = await ReportsService.submit(req.params.id!, req.user!.sub);
    res.json(report);
  } catch (err) { next(err); }
});

router.post('/:id/review', requireRole('director', 'hr'), validate(reviewReportSchema), async (req: Request, res: Response, next) => {
  try {
    const report = await ReportsService.review(req.params.id!, req.user!.sub, req.body.status, req.body.feedback);
    res.json(report);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const result = await ReportsService.delete(req.params.id!, req.user!.sub, req.user!.role);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
