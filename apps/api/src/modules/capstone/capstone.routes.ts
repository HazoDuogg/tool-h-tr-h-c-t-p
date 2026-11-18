import { Router } from 'express';
import { CapstoneController } from './capstone.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new CapstoneController();

router.use(requireAuth);
router.post('/tracks/:trackId/options', controller.getOrProposeOptions.bind(controller));
router.post('/tracks/:trackId/topic', controller.confirmCapstoneTopic.bind(controller));
router.post('/tracks/:trackId/blueprint', controller.submitBlueprint.bind(controller));
router.post('/tracks/:trackId/defense/start', controller.startLiveDefense.bind(controller));
router.post('/defense/challenge/save', controller.saveChallengeSolution.bind(controller));
router.post('/defense/sessions/:sessionId/finalize', controller.finalizeDefense.bind(controller));
router.get('/tracks/:trackId/defense/active', controller.getActiveDefenseSession.bind(controller));

export default router;