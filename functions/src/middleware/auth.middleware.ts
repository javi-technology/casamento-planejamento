import { NextFunction, Request, Response } from 'express';
import * as admin from 'firebase-admin';

export interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
    email: string;
  };
}

export function parseAllowedEmails(
  value = process.env.ALLOWED_EMAILS ?? '',
): string[] {
  return value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string | undefined, list: string[]): boolean {
  return Boolean(
    email &&
    list.some((allowed) => allowed.toLowerCase() === email.toLowerCase()),
  );
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(authorization.slice(7));
    const email = decoded.email;
    if (!isAllowed(email, parseAllowedEmails())) {
      res
        .status(403)
        .json({ error: 'Forbidden', message: 'E-mail não autorizado' });
      return;
    }
    (req as AuthenticatedRequest).user = {
      uid: decoded.uid,
      email: email ?? '',
    };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
