import { Router } from 'express';
import authRouter from './auth.routes';
import feedRouter from './feed.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/feed', feedRouter);

export default router;
