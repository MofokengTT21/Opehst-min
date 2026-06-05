import { Router } from 'express';
import { getPosts, createPost, pinPost, deletePost, createChannel, getChannels, createComment, createReaction, getHubs, createHub, getMembers } from '../controllers/feed.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Protect all feed routes to extract tenant_id and role from JWT
router.use(requireAuth);

router.get('/posts', getPosts);
router.post('/posts', createPost);
router.post('/posts/:id/pin', pinPost);
router.delete('/posts/:id', deletePost);

router.post('/posts/:postId/comments', createComment);
router.post('/posts/:postId/reactions', createReaction);

router.get('/hubs', getHubs);
router.post('/hubs', createHub);

router.get('/channels', getChannels);
router.post('/channels', createChannel);

router.get('/members', getMembers);

export default router;
