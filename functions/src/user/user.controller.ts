import { NextFunction, Request, Response } from 'express';
import * as userService from './user.service';
import {
  isValidInviteCode,
  normalizeSignup,
  validateSignup,
} from './user.validation';

export async function signup(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const input = normalizeSignup(req.body);
  const errors = validateSignup(input);
  if (errors.length) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Dados inválidos',
      details: errors,
    });
    return;
  }
  if (!isValidInviteCode(req.body?.inviteCode)) {
    res
      .status(403)
      .json({ error: 'Forbidden', message: 'Código de convite inválido' });
    return;
  }

  try {
    res.status(201).json(await userService.createUser(input));
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/email-already-exists') {
      res
        .status(409)
        .json({ error: 'Conflict', message: 'E-mail já cadastrado' });
      return;
    }
    next(error);
  }
}
