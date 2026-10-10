import { timingSafeEqual } from 'node:crypto';
import { ValidationError } from '../budget/budget.validation';
import { NewUser } from './user.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;

export function normalizeSignup(value: unknown): NewUser {
  const input = (value ?? {}) as Record<string, unknown>;
  const text = (field: string) =>
    typeof input[field] === 'string' ? (input[field] as string) : '';
  return {
    name: text('name').trim(),
    email: text('email').trim().toLowerCase(),
    password: text('password'),
  };
}

export function validateSignup(input: NewUser): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!input.name) {
    errors.push({ field: 'name', message: 'Nome é obrigatório' });
  }
  if (!EMAIL_PATTERN.test(input.email)) {
    errors.push({ field: 'email', message: 'Informe um e-mail válido' });
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      field: 'password',
      message: `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres`,
    });
  }
  return errors;
}

export function isValidInviteCode(
  value: unknown,
  expected = process.env.SIGNUP_CODE ?? '',
): boolean {
  if (!expected || typeof value !== 'string') {
    return false;
  }
  const given = Buffer.from(value);
  const secret = Buffer.from(expected);
  return given.length === secret.length && timingSafeEqual(given, secret);
}
