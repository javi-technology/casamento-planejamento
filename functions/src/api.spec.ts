import request from 'supertest';

const mockVerifyIdToken = jest.fn();

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({ verifyIdToken: mockVerifyIdToken })),
}));
jest.mock('firebase-admin/app', () => ({
  getApp: jest.fn(),
}));
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => 'server-timestamp'),
    delete: jest.fn(() => 'delete-field'),
  },
  getFirestore: jest.fn(),
}));
jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(),
}));
jest.mock('firebase-functions/v2/https', () => ({
  onRequest: jest.fn((_options: unknown, handler: unknown) => handler),
}));

import { app } from './index';
import { isAllowed, parseAllowedEmails } from './middleware/auth.middleware';
import { slug } from './contract/contract.service';

describe('auth helpers', () => {
  it('normaliza lista de e-mails com espaços e caixa', () => {
    expect(parseAllowedEmails(' A@EXAMPLE.COM, b@example.com , ')).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
  });

  it('compara e-mails sem diferenciar maiúsculas', () => {
    expect(isAllowed('Pessoa@Example.com', ['pessoa@example.com'])).toBe(true);
    expect(isAllowed('outro@example.com', ['pessoa@example.com'])).toBe(false);
  });

  it('gera slug sem acentos e caracteres especiais', () => {
    expect(slug('Buffet Sabor & Ação')).toBe('buffet-sabor-acao');
  });
});

describe('API authentication and validation', () => {
  beforeEach(() => {
    process.env.ALLOWED_EMAILS = 'permitido@example.com';
    mockVerifyIdToken.mockReset();
  });

  it('retorna 401 sem token', async () => {
    const response = await request(app).get('/api/me');
    expect(response.status).toBe(401);
  });

  it('retorna 401 quando o token é inválido', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid token'));
    const response = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer token');
    expect(response.status).toBe(401);
  });

  it('retorna 403 para e-mail não autorizado', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'uid-1',
      email: 'bloqueado@example.com',
    });
    const response = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer token');
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('E-mail não autorizado');
  });

  it('retorna os dados do usuário autorizado', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'uid-1',
      email: 'PERMITIDO@example.com',
    });
    const response = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer token');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      uid: 'uid-1',
      email: 'PERMITIDO@example.com',
    });
  });

  it('valida orçamento antes de acessar o banco', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'uid-1',
      email: 'permitido@example.com',
    });
    const response = await request(app)
      .put('/api/budget')
      .set('Authorization', 'Bearer token')
      .send({ guests: 0, maxBudget: -1, categories: [] });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });

  it('valida despesas antes de acessar o banco', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'uid-1',
      email: 'permitido@example.com',
    });
    const response = await request(app)
      .post('/api/expenses')
      .set('Authorization', 'Bearer token')
      .send({ supplier: '', estimated: -1 });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });
});
