import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { checkInSchema, listAttendanceSchema, updateAttendanceSchema, monthlyQuerySchema, deleteAttendanceSchema, locationOptionalSchema } from './attendance.schema';
import { AttendanceService, getAttendanceEvents, getAttendanceEventsForUser, getPauseLog } from './attendance.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

const router = Router();

router.use(authenticate);

router.post('/check-in', validate(checkInSchema), async (req: Request, res: Response, next) => {
  try {
    const record = await AttendanceService.checkIn(req.user!.sub, req.body);
    res.status(201).json(record);
  } catch (err) { next(err); }
});

router.post('/check-out', validate(locationOptionalSchema), async (req: Request, res: Response, next) => {
  try {
    const record = await AttendanceService.checkOut(req.user!.sub, req.body);
    res.json(record);
  } catch (err) { next(err); }
});

router.post('/pause-start', validate(locationOptionalSchema), async (req: Request, res: Response, next) => {
  try {
    const record = await AttendanceService.startPause(req.user!.sub, req.body);
    res.json(record);
  } catch (err) { next(err); }
});

router.post('/pause-end', validate(locationOptionalSchema), async (req: Request, res: Response, next) => {
  try {
    const record = await AttendanceService.endPause(req.user!.sub, req.body);
    res.json(record);
  } catch (err) { next(err); }
});

router.get('/events/:attendanceId', async (req: Request, res: Response, next) => {
  try {
    const isAdmin = req.user!.role === 'director' || req.user!.role === 'hr';
    const events = isAdmin
      ? getAttendanceEvents(req.params.attendanceId!)
      : getAttendanceEventsForUser(req.user!.sub, req.params.attendanceId!);
    res.json({ events });
  } catch (err) { next(err); }
});

router.get('/pause-log', requireRole('director', 'hr'), async (req: Request, res: Response, next) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const events = getPauseLog(startDate, endDate);
    res.json({ events });
  } catch (err) { next(err); }
});

router.get('/today', async (req: Request, res: Response, next) => {
  try {
    const record = await AttendanceService.getTodayStatus(req.user!.sub);
    res.json(record);
  } catch (err) { next(err); }
});

router.get('/today-all', requireRole('director', 'hr'), async (req: Request, res: Response, next) => {
  try {
    const records = await AttendanceService.getTodayAll();
    res.json(records);
  } catch (err) { next(err); }
});

router.get('/history/:userId', requireRole('director', 'hr'), async (req: Request, res: Response, next) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const result = await AttendanceService.getUserHistory(req.params.userId!, year, month, startDate, endDate);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/monthly', validate(monthlyQuerySchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const q = req.query as any;
    const targetUserId = (req.user!.role === 'director' || req.user!.role === 'hr') && q.userId ? q.userId : req.user!.sub;
    const summary = await AttendanceService.getMonthlySummary(targetUserId, q.year, q.month);
    res.json(summary);
  } catch (err) { next(err); }
});

router.get('/my', validate(listAttendanceSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const result = await AttendanceService.list({ ...req.query, userId: req.user!.sub });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/', requireRole('director', 'hr'), validate(listAttendanceSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const result = await AttendanceService.list(req.query as any);
    res.json(result);
  } catch (err) { next(err); }
});

router.patch('/:id', requireRole('director', 'hr'), validate(updateAttendanceSchema), async (req: Request, res: Response, next) => {
  try {
    const record = await AttendanceService.update(req.params.id!, req.body);
    res.json(record);
  } catch (err) { next(err); }
});

router.delete('/bulk', requireRole('director'), validate(deleteAttendanceSchema), async (req: Request, res: Response, next) => {
  try {
    const result = await AttendanceService.bulkDelete(req.body);
    try {
      ActivityLogsService.create(req.user!.sub, 'bulk_delete', 'attendance', undefined, { ...result.scope, deleted: result.deleted }, req.ip);
    } catch {}
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
