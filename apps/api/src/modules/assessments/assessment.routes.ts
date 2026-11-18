import { Router } from 'express';
import { AssessmentController } from './assessment.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new AssessmentController();

router.use(requireAuth);
router.post('/sandbox/run', controller.runCodeSandbox.bind(controller));
router.post('/modules/:moduleId/exam/start', controller.startModuleExam.bind(controller));
router.post('/exam/submit', controller.submitModuleExam.bind(controller));

export default router;