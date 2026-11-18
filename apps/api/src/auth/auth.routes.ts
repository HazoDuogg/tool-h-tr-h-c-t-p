import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();
const controller = new AuthController();

router.post('/register', controller.register.bind(controller));
router.post('/login', controller.login.bind(controller));
router.get('/me', requireAuth, controller.getMe.bind(controller));

export default router;