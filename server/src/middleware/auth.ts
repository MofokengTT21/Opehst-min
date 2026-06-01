import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'mock-jwt-secret-for-development';

// Extend Express Request object to hold user claims
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        tenant_id: string;
      };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Inject the exact claims we set in the /verify-otp route
    req.user = {
      id: decoded.sub,
      role: decoded.app_metadata?.user_role || 'user',
      tenant_id: decoded.app_metadata?.tenant_id
    };

    next();
  } catch (err) {
    console.error('JWT Verification Error:', err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
