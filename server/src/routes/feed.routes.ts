import { Router } from 'express';
import { getPosts, createPost, pinPost, deletePost, createGroup } from '../controllers/feed.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Protect all feed routes to extract tenant_id and role from JWT
router.use(requireAuth);

router.get('/posts', getPosts);
router.post('/posts', createPost);
router.post('/posts/:id/pin', pinPost);
router.delete('/posts/:id', deletePost);

router.post('/groups', createGroup);

export default router;
