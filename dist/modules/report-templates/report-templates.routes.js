import { Router } from 'express';
import { validate, requireUuid } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/rbac.js';
import { createTemplateSchema, updateTemplateSchema, listTemplatesSchema } from './report-templates.schema.js';
import { ReportTemplatesService } from './report-templates.service.js';
const router = Router();
router.use(authenticate);
router.get('/', requireRole('director', 'hr'), validate(listTemplatesSchema, 'query'), async (req, res, next) => {
    try {
        const result = await ReportTemplatesService.list(req.query);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', requireRole('director', 'hr'), requireUuid('id'), async (req, res, next) => {
    try {
        const template = await ReportTemplatesService.getById(req.params.id);
        res.json(template);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', requireRole('director', 'hr'), validate(createTemplateSchema), async (req, res, next) => {
    try {
        const template = await ReportTemplatesService.create(req.user.sub, req.body);
        res.status(201).json(template);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:id', requireRole('director', 'hr'), requireUuid('id'), validate(updateTemplateSchema), async (req, res, next) => {
    try {
        const template = await ReportTemplatesService.update(req.params.id, req.user.sub, req.body, req.user.role);
        res.json(template);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', requireRole('director', 'hr'), requireUuid('id'), async (req, res, next) => {
    try {
        const result = await ReportTemplatesService.delete(req.params.id, req.user.sub, req.user.role);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
export default router;
