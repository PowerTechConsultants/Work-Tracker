import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { apiCache } from '../../middleware/api-cache';
import { cache } from '../../lib/cache';
import { createUserSchema, deleteUserSchema, updateUserSchema, listUsersSchema } from './users.schema';
import { UsersService } from './users.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('director', 'hr'), apiCache({ ttl: 120_000 }), validate(listUsersSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const result = await UsersService.list(req.query as any);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/stats', requireRole('director', 'hr'), apiCache({ ttl: 120_000 }), async (_req: Request, res: Response, next) => {
  try {
    const stats = await UsersService.getStats();
    res.json(stats);
  } catch (err) { next(err); }
});

router.get('/:id', requireRole('director', 'hr'), apiCache({ ttl: 120_000 }), async (req: Request, res: Response, next) => {
  try {
    const user = await UsersService.getById(req.params.id!);
    res.json(user);
  } catch (err) { next(err); }
});

router.post('/', requireRole('director'), validate(createUserSchema), async (req: Request, res: Response, next) => {
  try {
    const user = await UsersService.create(req.body);
    cache.delByPrefix('/api/v1/users');
    try { ActivityLogsService.create(req.user!.sub, 'create', 'user', user.id, { email: req.body.email, role: req.body.role }, req.ip); } catch {}
    res.status(201).json(user);
  } catch (err) { next(err); }
});

router.patch('/:id', requireRole('director'), validate(updateUserSchema), async (req: Request, res: Response, next) => {
  try {
    const user = await UsersService.update(req.params.id!, req.body);
    cache.delByPrefix('/api/v1/users');
    try { ActivityLogsService.create(req.user!.sub, 'update', 'user', req.params.id, { changes: Object.keys(req.body) }, req.ip); } catch {}
    res.json(user);
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('director'), validate(deleteUserSchema), async (req: Request, res: Response, next) => {
  try {
    const result = await UsersService.delete(req.params.id!, req.body);
    cache.delByPrefix('/api/v1/users');
    try { ActivityLogsService.create(req.user!.sub, 'delete', 'user', req.params.id, undefined, req.ip); } catch {}
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
