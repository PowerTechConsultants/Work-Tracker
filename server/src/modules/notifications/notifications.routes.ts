import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { NotificationsService } from './notifications.service';
import { listNotificationsSchema } from './notifications.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate(listNotificationsSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const { unread, page, limit } = req.query as any;
    const result = await NotificationsService.list(req.user!.sub, { unreadOnly: unread, page, limit });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/read-all', async (req: Request, res: Response, next) => {
  try {
    const result = await NotificationsService.markAllRead(req.user!.sub);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/read', async (req: Request, res: Response, next) => {
  try {
    const notification = await NotificationsService.markRead(req.params.id!, req.user!.sub);
    res.json(notification);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const result = await NotificationsService.delete(req.params.id!, req.user!.sub);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
