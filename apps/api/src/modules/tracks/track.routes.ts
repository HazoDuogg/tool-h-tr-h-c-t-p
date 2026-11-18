import { Router } from 'express';
import { TrackController } from './track.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new TrackController();

router.use(requireAuth);
router.post('/', controller.createTrack.bind(controller));
router.get('/', controller.getMyTracks.bind(controller));
router.post('/mentor/ask', controller.askMentor.bind(controller));
router.post('/concept/explain', controller.explainConcept.bind(controller));

export default router;