import { Router } from 'express';
import authRouter from './auth.routes';
import feedRouter from './feed.routes';
import syncRouter from './sync.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/feed', feedRouter);
router.use('/sync', syncRouter);

export default router;
