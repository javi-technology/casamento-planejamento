import { getAuth } from 'firebase-admin/auth';
import { NextFunction, Request, Response } from 'express';
import { getUser } from '../user/user.service';
import { User } from '../user/user.types';

export interface AuthenticatedRequest extends Request {
  user: User;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Faça login' });
    return;
  }

  let uid: string;
  try {
    ({ uid } = await getAuth().verifyIdToken(token));
  } catch {
    res
      .status(401)
      .json({ error: 'Unauthorized', message: 'Sessão inválida ou expirada' });
    return;
  }

  try {
    const user = await getUser(uid);
    if (!user) {
      res
        .status(403)
        .json({ error: 'Forbidden', message: 'Usuário não cadastrado' });
      return;
    }
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    next(error);
  }
}
