import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { ActivityLogsService } from './activity-logs.service';
import { listActivityLogsSchema } from './activity-logs.schema';

const router = Router();

router.use(authenticate);
router.use(requireRole('director', 'hr'));

router.get('/', validate(listActivityLogsSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const result = await ActivityLogsService.list(req.query as any);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
