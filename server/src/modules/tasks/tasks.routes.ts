import { Router, Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import {
  createTaskSchema, updateTaskSchema, listTasksSchema,
  addCommentSchema, requestApprovalSchema, reviewApprovalSchema,
} from './tasks.schema';
import { TasksService } from './tasks.service';

const router = Router();

router.use(authenticate);

router.get('/stats', async (req: Request, res: Response, next) => {
  try {
    const stats = await TasksService.getStats(req.user!.sub, req.user!.role);
    res.json(stats);
  } catch (err) { next(err); }
});

router.get('/', validate(listTasksSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const result = await TasksService.list(req.query as any, req.user!.sub, req.user!.role);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/employee-progress', requireRole('director', 'hr'), async (req: Request, res: Response, next) => {
  try {
    const result = TasksService.getEmployeeProgress();
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const task = await TasksService.getById(req.params.id!, req.user!.sub, req.user!.role);
    res.json(task);
  } catch (err) { next(err); }
});

router.post('/', requireRole('director', 'hr'), validate(createTaskSchema), async (req: Request, res: Response, next) => {
  try {
    const task = await TasksService.create(req.user!.sub, req.body);
    res.status(201).json(task);
  } catch (err) { next(err); }
});

router.patch('/:id', validate(updateTaskSchema), async (req: Request, res: Response, next) => {
  try {
    const task = await TasksService.update(req.params.id!, req.body, req.user!.sub, req.user!.role);
    res.json(task);
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('director'), async (req: Request, res: Response, next) => {
  try {
    const result = await TasksService.delete(req.params.id!);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id/comments', async (req: Request, res: Response, next) => {
  try {
    const result = await TasksService.getComments(req.params.id!, req.user!.sub, req.user!.role);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/:id/comments', validate(addCommentSchema), async (req: Request, res: Response, next) => {
  try {
    const comment = await TasksService.addComment(req.params.id!, req.user!.sub, req.body.message, req.user!.role);
    res.status(201).json(comment);
  } catch (err) { next(err); }
});

router.patch('/approvals/:approvalId', requireRole('director', 'hr'), validate(reviewApprovalSchema), async (req: Request, res: Response, next) => {
  try {
    const approval = await TasksService.reviewApproval(req.params.approvalId!, req.user!.sub, req.body.status, req.body.comment);
    res.json(approval);
  } catch (err) { next(err); }
});

router.post('/:id/approvals', validate(requestApprovalSchema), async (req: Request, res: Response, next) => {
  try {
    const approval = await TasksService.requestApproval(req.params.id!, req.user!.sub, req.body.comment, req.user!.role);
    res.status(201).json(approval);
  } catch (err) { next(err); }
});

export default router;
