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
import {
  isAllowed,
  parseAllowedEmails,
  parseUserNames,
} from './middleware/auth.middleware';
import { slug } from './contract/contract.service';
import { validateBudgetInput } from './budget/budget.validation';
import * as budgetService from './budget/budget.service';

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

  it('lê nomes de USER_NAMES, ignorando entradas inválidas', () => {
    expect(
      parseUserNames(
        'Noiva@Example.com:Maria, noivo@example.com : João Pedro ,invalido,:semEmail,a@b.com:',
      ),
    ).toEqual({
      'noiva@example.com': 'Maria',
      'noivo@example.com': 'João Pedro',
    });
  });

  it('devolve mapa vazio quando USER_NAMES não está definida', () => {
    expect(parseUserNames('')).toEqual({});
  });

  it('gera slug sem acentos e caracteres especiais', () => {
    expect(slug('Buffet Sabor & Ação')).toBe('buffet-sabor-acao');
  });
});

describe('validação de responsável da categoria', () => {
  const budget = (responsible?: unknown) => ({
    guests: 100,
    maxBudget: 1000,
    categories: [
      {
        id: 'bebidas',
        name: 'Bebidas',
        suggestedPct: 8,
        perGuest: true,
        ...(responsible === undefined ? {} : { responsible }),
      },
    ],
  });
  const allowed = ['noiva@example.com', 'noivo@example.com'];

  it('aceita categoria sem responsável (orçamentos antigos)', () => {
    expect(validateBudgetInput(budget(), false, allowed)).toEqual([]);
  });

  it('aceita responsável permitido sem diferenciar maiúsculas', () => {
    expect(
      validateBudgetInput(budget('NOIVA@example.com'), false, allowed),
    ).toEqual([]);
  });

  it.each([42, null, {}])(
    'rejeita responsável que não é texto (%p)',
    (responsible) => {
      const errors = validateBudgetInput(budget(responsible), false, allowed);

      expect(errors.map((error) => error.field)).toEqual([
        'categories[0].responsible',
      ]);
    },
  );
});

describe('responsável que saiu da allowlist', () => {
  const category = (id: string, responsible?: string) => ({
    id,
    name: id,
    suggestedPct: 8,
    perGuest: true,
    ...(responsible === undefined ? {} : { responsible }),
  });
  const budget = (...categories: ReturnType<typeof category>[]) => ({
    guests: 100,
    maxBudget: 1000,
    categories,
  });
  const allowed = ['noiva@example.com'];

  it('mantém a atribuição já salva na categoria', () => {
    const errors = validateBudgetInput(
      budget(category('bebidas', 'Antigo@example.com')),
      false,
      allowed,
      { bebidas: 'antigo@example.com' },
    );

    expect(errors).toEqual([]);
  });

  it('não permite atribuir o e-mail removido a outra categoria', () => {
    const errors = validateBudgetInput(
      budget(
        category('bebidas', 'antigo@example.com'),
        category('buffet', 'antigo@example.com'),
      ),
      false,
      allowed,
      { bebidas: 'antigo@example.com' },
    );

    expect(errors.map((error) => error.field)).toEqual([
      'categories[1].responsible',
    ]);
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
    expect(response.body).toEqual({
      email: 'PERMITIDO@example.com',
      name: 'PERMITIDO@example.com',
    });
  });

  it('informa os possíveis responsáveis junto do orçamento', async () => {
    process.env.ALLOWED_EMAILS = 'Noiva@example.com, noivo@example.com';
    jest.spyOn(budgetService, 'getBudget').mockResolvedValue({
      guests: 100,
      maxBudget: 1000,
      categories: [],
      expenses: [],
    });

    const response = await request(app)
      .get('/api/budget')
      .set('X-User-Email', 'noiva@example.com');

    expect(response.status).toBe(200);
    expect(response.body.responsibles).toEqual([
      'noiva@example.com',
      'noivo@example.com',
    ]);
  });

  it('informa os nomes dos responsáveis que têm nome configurado', async () => {
    process.env.ALLOWED_EMAILS = 'noiva@example.com, noivo@example.com';
    process.env.USER_NAMES = 'Noiva@example.com:Maria,fora@example.com:Fulano';
    jest.spyOn(budgetService, 'getBudget').mockResolvedValue({
      guests: 100,
      maxBudget: 1000,
      categories: [],
      expenses: [],
    });

    const response = await request(app)
      .get('/api/budget')
      .set('X-User-Email', 'noiva@example.com');

    expect(response.body.userNames).toEqual({
      'noiva@example.com': 'Maria',
    });
    delete process.env.USER_NAMES;
  });

  it('GET /api/me devolve o nome do usuário, com e-mail como fallback', async () => {
    process.env.ALLOWED_EMAILS = 'noiva@example.com,noivo@example.com';
    process.env.USER_NAMES = 'noiva@example.com:Maria';

    const named = await request(app)
      .get('/api/me')
      .set('X-User-Email', 'NOIVA@example.com');
    const unnamed = await request(app)
      .get('/api/me')
      .set('X-User-Email', 'noivo@example.com');

    expect(named.body).toEqual({ email: 'NOIVA@example.com', name: 'Maria' });
    expect(unnamed.body).toEqual({
      email: 'noivo@example.com',
      name: 'noivo@example.com',
    });
    delete process.env.USER_NAMES;
  });

  it('valida orçamento antes de acessar o banco', async () => {
    const response = await request(app)
      .put('/api/budget')
      .set('X-User-Email', 'permitido@example.com')
      .send({ guests: 0, maxBudget: -1, categories: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });

  it('rejeita responsável da categoria fora da lista permitida', async () => {
    const response = await request(app)
      .put('/api/budget')
      .set('X-User-Email', 'permitido@example.com')
      .send({
        guests: 100,
        maxBudget: 1000,
        categories: [
          {
            id: 'bebidas',
            name: 'Bebidas',
            suggestedPct: 8,
            perGuest: true,
            responsible: 'intruso@example.com',
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
    expect(JSON.stringify(response.body)).toContain(
      'categories[0].responsible',
    );
  });

  it('permite salvar o orçamento com responsável removido da allowlist', async () => {
    const stored = {
      id: 'bebidas',
      name: 'Bebidas',
      suggestedPct: 8,
      perGuest: true,
      responsible: 'antigo@example.com',
    };
    jest.spyOn(budgetService, 'getBudget').mockResolvedValue({
      guests: 100,
      maxBudget: 1000,
      categories: [stored],
      expenses: [],
    });
    const update = jest.spyOn(budgetService, 'updateBudget').mockResolvedValue({
      guests: 120,
      maxBudget: 1000,
      categories: [stored],
      expenses: [],
    });

    const response = await request(app)
      .put('/api/budget')
      .set('X-User-Email', 'permitido@example.com')
      .send({ guests: 120, maxBudget: 1000, categories: [stored] });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalled();
  });

  it('salva o responsável em minúsculas', async () => {
    jest.spyOn(budgetService, 'getBudget').mockResolvedValue({
      guests: 100,
      maxBudget: 1000,
      categories: [],
      expenses: [],
    });
    const update = jest.spyOn(budgetService, 'updateBudget').mockResolvedValue({
      guests: 100,
      maxBudget: 1000,
      categories: [],
      expenses: [],
    });

    const response = await request(app)
      .put('/api/budget')
      .set('X-User-Email', 'permitido@example.com')
      .send({
        guests: 100,
        maxBudget: 1000,
        categories: [
          {
            id: 'bebidas',
            name: 'Bebidas',
            suggestedPct: 8,
            perGuest: true,
            responsible: 'PERMITIDO@example.com',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(update.mock.calls.at(-1)?.[0].categories[0].responsible).toBe(
      'permitido@example.com',
    );
  });

  it('importa o responsável em minúsculas', async () => {
    const importBudget = jest
      .spyOn(budgetService, 'importBudget')
      .mockResolvedValue({
        guests: 100,
        maxBudget: 1000,
        categories: [],
        expenses: [],
      });

    const response = await request(app)
      .post('/api/budget/import')
      .set('X-User-Email', 'permitido@example.com')
      .send({
        guests: 100,
        maxBudget: 1000,
        expenses: [],
        categories: [
          {
            id: 'bebidas',
            name: 'Bebidas',
            suggestedPct: 8,
            perGuest: true,
            responsible: 'PERMITIDO@example.com',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(importBudget.mock.calls.at(-1)?.[0].categories[0].responsible).toBe(
      'permitido@example.com',
    );
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
