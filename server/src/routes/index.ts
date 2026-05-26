import { Router } from 'express';
import postsRouter from './posts.routes';

const router = Router();

router.use('/posts', postsRouter);

export default router;
