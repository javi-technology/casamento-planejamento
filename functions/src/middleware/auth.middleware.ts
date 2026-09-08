import { NextFunction, Request, Response } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
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
  const email = req.headers['x-user-email'];
  const normalizedEmail = Array.isArray(email)
    ? email[0]?.trim()
    : email?.trim();
  if (!normalizedEmail) {
    res
      .status(401)
      .json({ error: 'Unauthorized', message: 'Informe seu e-mail' });
    return;
  }

  if (!isAllowed(normalizedEmail, parseAllowedEmails())) {
    res
      .status(403)
      .json({ error: 'Forbidden', message: 'E-mail não autorizado' });
    return;
  }

  (req as AuthenticatedRequest).user = { email: normalizedEmail };
  next();
}
