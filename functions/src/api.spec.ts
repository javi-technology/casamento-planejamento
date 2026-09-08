import request from 'supertest';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
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

describe('API de login e autenticação', () => {
  beforeEach(() => {
    process.env.ALLOWED_EMAILS = 'permitido@example.com';
  });

  it('retorna 200 para e-mail autorizado', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({ email: 'PERMITIDO@example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ email: 'PERMITIDO@example.com' });
  });

  it('retorna 403 para e-mail não autorizado', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({ email: 'bloqueado@example.com' });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('E-mail não autorizado');
  });

  it.each([{}, { email: 'invalido' }])(
    'retorna 400 para e-mail ausente ou inválido',
    async (body) => {
      const response = await request(app).post('/api/login').send(body);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    },
  );

  it('ignora o cabeçalho Authorization', async () => {
    const response = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer permitido@example.com');

    expect(response.status).toBe(401);
  });

  it('retorna 401 quando falta o cabeçalho de e-mail', async () => {
    const response = await request(app).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Unauthorized',
      message: 'Informe seu e-mail',
    });
  });

  it('retorna 403 para e-mail não autorizado no cabeçalho', async () => {
    const response = await request(app)
      .get('/api/me')
      .set('X-User-Email', 'bloqueado@example.com');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('E-mail não autorizado');
  });

  it('retorna os dados do usuário autorizado', async () => {
    const response = await request(app)
      .get('/api/me')
      .set('X-User-Email', 'PERMITIDO@example.com');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ email: 'PERMITIDO@example.com' });
  });

  it('valida orçamento antes de acessar o banco', async () => {
    const response = await request(app)
      .put('/api/budget')
      .set('X-User-Email', 'permitido@example.com')
      .send({ guests: 0, maxBudget: -1, categories: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });

  it('valida despesas antes de acessar o banco', async () => {
    const response = await request(app)
      .post('/api/expenses')
      .set('X-User-Email', 'permitido@example.com')
      .send({ supplier: '', estimated: -1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });
});
