import request from 'supertest';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
}));
jest.mock('firebase-admin/app', () => ({
  getApp: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
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

import { getAuth } from 'firebase-admin/auth';
import { app } from './index';
import { slug } from './contract/contract.service';
import {
  migrateResponsibles,
  validateBudgetInput,
} from './budget/budget.validation';
import * as budgetService from './budget/budget.service';
import * as userService from './user/user.service';
import { User } from './user/user.types';

const MARIA: User = { id: 'uid-maria', name: 'Maria', email: 'maria@x.com' };
const JOAO: User = { id: 'uid-joao', name: 'João', email: 'joao@x.com' };
const TOKEN = 'Bearer token-maria';

function category(id: string, responsible?: string) {
  return {
    id,
    name: id,
    suggestedPct: 8,
    perGuest: true,
    ...(responsible === undefined ? {} : { responsible }),
  };
}

function budget(...categories: ReturnType<typeof category>[]) {
  return { guests: 100, maxBudget: 1000, categories, expenses: [] };
}

beforeEach(() => {
  jest.restoreAllMocks();
  (getAuth as jest.Mock).mockReturnValue({
    verifyIdToken: jest.fn(async (token: string) => {
      const uid = { 'token-maria': 'uid-maria', 'token-orfao': 'uid-orfao' }[
        token
      ];
      if (!uid) {
        throw new Error('token inválido');
      }
      return { uid };
    }),
  });
  jest
    .spyOn(userService, 'getUser')
    .mockImplementation(async (id) => (id === MARIA.id ? MARIA : null));
  jest.spyOn(userService, 'listUsers').mockResolvedValue([JOAO, MARIA]);
});

describe('helpers', () => {
  it('gera slug sem acentos e caracteres especiais', () => {
    expect(slug('Buffet Sabor & Ação')).toBe('buffet-sabor-acao');
  });
});

describe('validação de responsável da categoria', () => {
  const ids = [MARIA.id, JOAO.id];

  it('aceita categoria sem responsável (orçamentos antigos)', () => {
    expect(
      validateBudgetInput(budget(category('bebidas')), false, ids),
    ).toEqual([]);
  });

  it('aceita responsável que é um usuário cadastrado', () => {
    expect(
      validateBudgetInput(budget(category('bebidas', MARIA.id)), false, ids),
    ).toEqual([]);
  });

  it.each([42, null, {}])(
    'rejeita responsável que não é texto (%p)',
    (responsible) => {
      const errors = validateBudgetInput(
        budget({ ...category('bebidas'), responsible } as never),
        false,
        ids,
      );

      expect(errors.map((error) => error.field)).toEqual([
        'categories[0].responsible',
      ]);
    },
  );

  it('rejeita responsável que não é usuário cadastrado', () => {
    const errors = validateBudgetInput(
      budget(category('bebidas', 'uid-intruso')),
      false,
      ids,
    );

    expect(errors.map((error) => error.field)).toEqual([
      'categories[0].responsible',
    ]);
  });

  it('mantém a atribuição já salva na categoria', () => {
    expect(
      validateBudgetInput(
        budget(category('bebidas', 'uid-antigo')),
        false,
        ids,
        {
          bebidas: 'uid-antigo',
        },
      ),
    ).toEqual([]);
  });

  it('não permite atribuir o responsável antigo a outra categoria', () => {
    const errors = validateBudgetInput(
      budget(
        category('bebidas', 'uid-antigo'),
        category('buffet', 'uid-antigo'),
      ),
      false,
      ids,
      { bebidas: 'uid-antigo' },
    );

    expect(errors.map((error) => error.field)).toEqual([
      'categories[1].responsible',
    ]);
  });
});

describe('migração de responsável por e-mail', () => {
  it('troca o e-mail pelo id do usuário, sem diferenciar maiúsculas', () => {
    expect(
      migrateResponsibles([category('bebidas', 'MARIA@x.com')], [MARIA, JOAO]),
    ).toEqual([category('bebidas', MARIA.id)]);
  });

  it('remove o responsável cujo e-mail não tem usuário cadastrado', () => {
    expect(
      migrateResponsibles([category('bebidas', 'antigo@x.com')], [MARIA]),
    ).toEqual([category('bebidas')]);
  });

  it('não altera categorias e responsáveis inválidos, deixando para a validação', () => {
    const categories = [null, { ...category('bebidas'), responsible: 42 }];

    expect(migrateResponsibles(categories as never[], [MARIA])).toEqual(
      categories,
    );
  });

  it('mantém ids e categorias sem responsável', () => {
    const categories = [category('bebidas', JOAO.id), category('buffet')];

    expect(migrateResponsibles(categories, [MARIA])).toEqual(categories);
  });
});

describe('POST /api/signup', () => {
  const body = {
    name: '  Maria  ',
    email: 'Maria@X.com',
    password: 'segredo123',
    inviteCode: 'convite-secreto',
  };

  beforeEach(() => {
    process.env.SIGNUP_CODE = 'convite-secreto';
  });

  afterAll(() => {
    delete process.env.SIGNUP_CODE;
  });

  it('cria o usuário com nome sem espaços e e-mail em minúsculas', async () => {
    const create = jest
      .spyOn(userService, 'createUser')
      .mockResolvedValue(MARIA);

    const response = await request(app).post('/api/signup').send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(MARIA);
    expect(create).toHaveBeenCalledWith({
      name: 'Maria',
      email: 'maria@x.com',
      password: 'segredo123',
    });
  });

  it('retorna 403 para código de convite inválido', async () => {
    const create = jest.spyOn(userService, 'createUser');

    const response = await request(app)
      .post('/api/signup')
      .send({ ...body, inviteCode: 'errado' });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Código de convite inválido');
    expect(create).not.toHaveBeenCalled();
  });

  it('retorna 403 quando SIGNUP_CODE não está configurada', async () => {
    delete process.env.SIGNUP_CODE;

    const response = await request(app)
      .post('/api/signup')
      .send({ ...body, inviteCode: '' });

    expect(response.status).toBe(403);
  });

  it('retorna 409 quando o e-mail já está cadastrado', async () => {
    jest
      .spyOn(userService, 'createUser')
      .mockRejectedValue({ code: 'auth/email-already-exists' });

    const response = await request(app).post('/api/signup').send(body);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('E-mail já cadastrado');
  });

  it.each([
    ['nome vazio', { name: '   ' }, 'name'],
    ['e-mail inválido', { email: 'invalido' }, 'email'],
    ['senha curta', { password: '12345' }, 'password'],
  ])('retorna 400 para %s', async (_label, override, field) => {
    const create = jest.spyOn(userService, 'createUser');

    const response = await request(app)
      .post('/api/signup')
      .send({ ...body, ...override });

    expect(response.status).toBe(400);
    expect(
      response.body.details.map((d: { field: string }) => d.field),
    ).toEqual([field]);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('autenticação', () => {
  it('retorna 401 sem token', async () => {
    const response = await request(app).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
  });

  it('retorna 401 para token inválido', async () => {
    const response = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer token-falso');

    expect(response.status).toBe(401);
  });

  it('ignora o cabeçalho X-User-Email', async () => {
    const response = await request(app)
      .get('/api/me')
      .set('X-User-Email', MARIA.email);

    expect(response.status).toBe(401);
  });

  it('retorna 403 para usuário autenticado sem cadastro', async () => {
    const response = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer token-orfao');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Usuário não cadastrado');
  });

  it('não expõe mais a rota de login por e-mail', async () => {
    const response = await request(app)
      .post('/api/login')
      .set('Authorization', TOKEN)
      .send({ email: MARIA.email });

    expect(response.status).toBe(404);
  });

  it('GET /api/me devolve id, e-mail e nome do usuário', async () => {
    const response = await request(app)
      .get('/api/me')
      .set('Authorization', TOKEN);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(MARIA);
  });
});

describe('orçamento', () => {
  it('devolve os usuários e migra responsáveis por e-mail', async () => {
    jest
      .spyOn(budgetService, 'getBudget')
      .mockResolvedValue(
        budget(category('bebidas', 'maria@x.com'), category('buffet')),
      );

    const response = await request(app)
      .get('/api/budget')
      .set('Authorization', TOKEN);

    expect(response.status).toBe(200);
    expect(response.body.users).toEqual([JOAO, MARIA]);
    expect(response.body.categories).toEqual([
      category('bebidas', MARIA.id),
      category('buffet'),
    ]);
    expect(response.body.responsibles).toBeUndefined();
    expect(response.body.userNames).toBeUndefined();
  });

  it('valida orçamento antes de acessar o banco', async () => {
    jest.spyOn(budgetService, 'getBudget').mockResolvedValue(budget());

    const response = await request(app)
      .put('/api/budget')
      .set('Authorization', TOKEN)
      .send({ guests: 0, maxBudget: -1, categories: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });

  it('rejeita responsável que não é usuário cadastrado', async () => {
    jest.spyOn(budgetService, 'getBudget').mockResolvedValue(budget());

    const response = await request(app)
      .put('/api/budget')
      .set('Authorization', TOKEN)
      .send(budget(category('bebidas', 'maria@x.com')));

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toContain(
      'categories[0].responsible',
    );
  });

  it('salva o id do usuário como responsável', async () => {
    jest.spyOn(budgetService, 'getBudget').mockResolvedValue(budget());
    const update = jest
      .spyOn(budgetService, 'updateBudget')
      .mockResolvedValue(budget(category('bebidas', JOAO.id)));

    const response = await request(app)
      .put('/api/budget')
      .set('Authorization', TOKEN)
      .send(budget(category('bebidas', JOAO.id)));

    expect(response.status).toBe(200);
    expect(update.mock.calls.at(-1)?.[0].categories).toEqual([
      category('bebidas', JOAO.id),
    ]);
  });

  it('aceita salvar o responsável migrado de e-mail para id', async () => {
    jest
      .spyOn(budgetService, 'getBudget')
      .mockResolvedValue(budget(category('bebidas', 'maria@x.com')));
    const update = jest
      .spyOn(budgetService, 'updateBudget')
      .mockResolvedValue(budget(category('bebidas', MARIA.id)));

    const response = await request(app)
      .put('/api/budget')
      .set('Authorization', TOKEN)
      .send(budget(category('bebidas', MARIA.id)));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalled();
  });

  it('importa orçamento convertendo responsável por e-mail em id', async () => {
    const importBudget = jest
      .spyOn(budgetService, 'importBudget')
      .mockResolvedValue(budget());

    const response = await request(app)
      .post('/api/budget/import')
      .set('Authorization', TOKEN)
      .send(
        budget(
          category('bebidas', 'JOAO@x.com'),
          category('buffet', 'x@x.com'),
        ),
      );

    expect(response.status).toBe(200);
    expect(importBudget.mock.calls.at(-1)?.[0].categories).toEqual([
      category('bebidas', JOAO.id),
      category('buffet'),
    ]);
  });

  it('valida despesas antes de acessar o banco', async () => {
    const response = await request(app)
      .post('/api/expenses')
      .set('Authorization', TOKEN)
      .send({ supplier: '', estimated: -1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
  });
});
