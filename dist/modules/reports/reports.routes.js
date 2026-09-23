import { Router } from 'express';
import { validate, requireUuid } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/rbac.js';
import { apiCache } from '../../middleware/api-cache.js';
import { createReportSchema, updateReportSchema, listReportsSchema, reviewReportSchema } from './reports.schema.js';
import { ReportsService } from './reports.service.js';
const router = Router();
router.use(authenticate);
router.get('/', apiCache({ ttl: 60_000 }), validate(listReportsSchema, 'query'), async (req, res, next) => {
    try {
        const result = await ReportsService.list(req.query, req.user.sub, req.user.role);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.get('/slots', requireRole('director', 'hr'), async (_req, res, next) => {
    try {
        const slots = await ReportsService.getEmployeeSlots();
        res.json(slots);
    }
    catch (err) {
        next(err);
    }
});
router.get('/export', requireRole('director', 'hr'), async (req, res, next) => {
    try {
        const userId = req.query.userId;
        if (userId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
            res.status(400).json({ error: 'Invalid userId format' });
            return;
        }
        const reports = await ReportsService.exportByUser(userId, req.query.startDate, req.query.endDate);
        res.json(reports);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', requireUuid('id'), async (req, res, next) => {
    try {
        const report = await ReportsService.getById(req.params.id, req.user.sub, req.user.role);
        res.json(report);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', validate(createReportSchema), async (req, res, next) => {
    try {
        const report = await ReportsService.create(req.user.sub, req.body);
        res.status(201).json(report);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:id', requireUuid('id'), validate(updateReportSchema), async (req, res, next) => {
    try {
        const report = await ReportsService.update(req.params.id, req.user.sub, req.body, req.user.role);
        res.json(report);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/submit', requireUuid('id'), async (req, res, next) => {
    try {
        const report = await ReportsService.submit(req.params.id, req.user.sub);
        res.json(report);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/review', requireRole('director', 'hr'), requireUuid('id'), validate(reviewReportSchema), async (req, res, next) => {
    try {
        const report = await ReportsService.review(req.params.id, req.user.sub, req.body.status, req.body.feedback);
        res.json(report);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', requireUuid('id'), async (req, res, next) => {
    try {
        const result = await ReportsService.delete(req.params.id, req.user.sub, req.user.role);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
export default router;
