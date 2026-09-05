import { Router, Request, Response } from 'express';
import { validate, requireUuid } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { createTemplateSchema, updateTemplateSchema, listTemplatesSchema } from './report-templates.schema';
import { ReportTemplatesService } from './report-templates.service';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('director', 'hr'), validate(listTemplatesSchema, 'query'), async (req: Request, res: Response, next) => {
  try {
    const result = await ReportTemplatesService.list(req.query as any);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/:id', requireRole('director', 'hr'), requireUuid('id'), async (req: Request, res: Response, next) => {
  try {
    const template = await ReportTemplatesService.getById(req.params.id!);
    res.json(template);
  } catch (err) { next(err); }
});

router.post('/', requireRole('director', 'hr'), validate(createTemplateSchema), async (req: Request, res: Response, next) => {
  try {
    const template = await ReportTemplatesService.create(req.user!.sub, req.body);
    res.status(201).json(template);
  } catch (err) { next(err); }
});

router.patch('/:id', requireRole('director', 'hr'), requireUuid('id'), validate(updateTemplateSchema), async (req: Request, res: Response, next) => {
  try {
    const template = await ReportTemplatesService.update(req.params.id!, req.user!.sub, req.body, req.user!.role);
    res.json(template);
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('director', 'hr'), requireUuid('id'), async (req: Request, res: Response, next) => {
  try {
    const result = await ReportTemplatesService.delete(req.params.id!, req.user!.sub, req.user!.role);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
