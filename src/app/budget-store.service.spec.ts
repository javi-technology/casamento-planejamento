import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from './core/api.service';
import { DEFAULT_CATEGORIES, PERCENTAGE_PROFILES } from './models';
import {
  BudgetStore,
  STORAGE_KEY,
  createDefaultBudget,
} from './budget-store.service';

describe('BudgetStore', () => {
  let store: BudgetStore;
  let api: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getBudget',
      'updateBudget',
      'importBudget',
      'createExpense',
      'updateExpense',
      'deleteExpense',
    ]);
    api.getBudget.and.returnValue(of(createDefaultBudget()));
    api.updateBudget.and.returnValue(of(createDefaultBudget()));
    api.importBudget.and.returnValue(of(createDefaultBudget()));
    TestBed.configureTestingModule({
      providers: [BudgetStore, { provide: ApiService, useValue: api }],
    });
    store = TestBed.inject(BudgetStore);
  });

  it('calcula os totais de estimado, contratado e pago', () => {
    const categoryId = store.budget().categories[0].id;
    store.budget.update((budget) => ({
      ...budget,
      expenses: [
        {
          id: '1',
          categoryId,
          supplier: 'Fornecedor A',
          estimated: 1000,
          contracted: 800,
          paid: 300,
        },
        {
          id: '2',
          categoryId,
          supplier: 'Fornecedor B',
          estimated: 500,
          contracted: 400,
          paid: 200,
        },
      ],
    }));

    expect(store.totalEstimated()).toBe(1500);
    expect(store.totalContracted()).toBe(1200);
    expect(store.totalPaid()).toBe(500);
    expect(store.remaining()).toBe(48_800);
  });

  it('agrega valores por categoria e calcula a diferença', () => {
    const [first, second] = store.budget().categories;
    store.budget.update((budget) => ({
      ...budget,
      expenses: [
        {
          id: '1',
          categoryId: first.id,
          supplier: 'Espaço',
          estimated: 10_000,
          contracted: 8_000,
          paid: 2_000,
        },
        {
          id: '2',
          categoryId: second.id,
          supplier: 'Buffet',
          estimated: 20_000,
          contracted: 15_000,
          paid: 5_000,
        },
      ],
    }));

    const summary = store.categorySummaries();
    expect(summary[0].estimated).toBe(10_000);
    expect(summary[0].contracted).toBe(8_000);
    expect(summary[0].paid).toBe(2_000);
    expect(summary[0].suggested).toBe(7500);
    expect(summary[0].difference).toBe(-500);
    expect(summary[1].contracted).toBe(15_000);
  });

  it('calcula o orçamento sugerido por convidado', () => {
    store.budget.update((budget) => ({
      ...budget,
      guests: 150,
      maxBudget: 60_000,
    }));
    const buffet = store
      .categorySummaries()
      .find((category) => category.id === 'buffet-comida');

    expect(buffet?.suggested).toBe(18_000);
    expect(buffet?.perGuestAmount).toBe(120);
  });

  it('remove uma categoria sem fornecedores', () => {
    const categoryId = store.budget().categories[0].id;

    store.removeCategory(categoryId);

    expect(
      store.budget().categories.some((category) => category.id === categoryId),
    ).toBeFalse();
  });

  it('não remove categoria com fornecedores vinculados', () => {
    const categoryId = store.budget().categories[0].id;
    const total = store.budget().categories.length;
    store.budget.update((budget) => ({
      ...budget,
      expenses: [
        {
          id: '1',
          categoryId,
          supplier: 'Fornecedor A',
          estimated: 1000,
          contracted: 800,
          paid: 0,
        },
      ],
    }));

    store.removeCategory(categoryId);

    expect(store.budget().categories.length).toBe(total);
    expect(store.categoryHasExpenses(categoryId)).toBeTrue();
  });

  it('exibe uma migração quando há dados locais e o servidor está vazio', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...createDefaultBudget(), guests: 180 }),
    );
    await store.load();

    expect(store.migrationCandidate()?.guests).toBe(180);
    store.discardLegacy();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('carrega os usuários cadastrados sem misturá-los ao orçamento', async () => {
    const users = [{ id: 'uid-maria', name: 'Maria', email: 'maria@x.com' }];
    api.getBudget.and.returnValue(of({ ...createDefaultBudget(), users }));

    await store.load();

    expect(store.users()).toEqual(users);
    expect('users' in store.budget()).toBeFalse();
  });

  it('define o responsável de uma categoria e salva no servidor', fakeAsync(() => {
    const categoryId = store.budget().categories[0].id;
    api.updateBudget.and.callFake((budget) => of({ ...budget, expenses: [] }));

    store.updateCategory(categoryId, { responsible: 'uid-maria' });
    tick(500);

    expect(store.budget().categories[0].responsible).toBe('uid-maria');
    expect(
      api.updateBudget.calls.mostRecent().args[0].categories[0].responsible,
    ).toBe('uid-maria');
  }));

  describe('perfis de porcentagem', () => {
    const pct = (id: string): number | undefined =>
      store.budget().categories.find((category) => category.id === id)
        ?.suggestedPct;
    const customId = (name: string): string =>
      store.budget().categories.find((category) => category.name === name)!.id;

    it('cada perfil soma 100%', () => {
      for (const profile of PERCENTAGE_PROFILES) {
        const total = profile.shares.reduce((sum, share) => sum + share.pct, 0);
        expect(total).withContext(profile.name).toBe(100);
      }
    });

    it('o perfil Padrão restaura os percentuais de DEFAULT_CATEGORIES', () => {
      for (const category of store.budget().categories) {
        store.updateCategory(category.id, { suggestedPct: 1 });
      }

      store.applyPercentageProfile('padrao');

      expect(
        store.budget().categories.map((category) => category.suggestedPct),
      ).toEqual(DEFAULT_CATEGORIES.map((category) => category.suggestedPct));
    });

    it('o perfil Focado no básico zera o restante e reconhece a Assessoria criada pelo usuário', () => {
      store.addCategory('Assessoria/cerimonial', 7);

      store.applyPercentageProfile('basico');

      expect(pct('espaco-cerimonia')).toBe(30);
      expect(pct('buffet-comida')).toBe(35);
      expect(pct('decoracao-flores')).toBe(20);
      expect(pct(customId('Assessoria/cerimonial'))).toBe(15);
      expect(pct('bebidas')).toBe(0);
      expect(store.suggestedPctTotal()).toBe(100);
    });

    it('mantém perGuest, responsável, nome e despesas', () => {
      store.updateCategory('buffet-comida', { responsible: 'uid-maria' });
      store.budget.update((budget) => ({
        ...budget,
        expenses: [
          {
            id: '1',
            categoryId: 'buffet-comida',
            supplier: 'Buffet X',
            estimated: 100,
            contracted: 90,
            paid: 10,
          },
        ],
      }));
      const before = store.budget().categories;

      store.applyPercentageProfile('agressivo');

      const after = store.budget().categories;
      expect(after.map(({ suggestedPct, ...rest }) => rest)).toEqual(
        before.map(({ suggestedPct, ...rest }) => rest),
      );
      expect(store.budget().expenses.length).toBe(1);
    });

    it('mantém o percentual de categorias que o perfil não conhece', () => {
      store.addCategory('Transporte', 4);

      store.applyPercentageProfile('agressivo');

      expect(pct(customId('Transporte'))).toBe(4);
    });

    it('reconhece Assessoria pelo prefixo do nome', () => {
      store.addCategory('Assessoria', 7);
      store.addCategory('Assessoria e Cerimonial', 3);

      store.applyPercentageProfile('basico');

      expect(pct(customId('Assessoria'))).toBe(15);
      expect(pct(customId('Assessoria e Cerimonial'))).toBe(3);
    });

    it('dá prioridade ao id sobre o nome nas categorias padrão', () => {
      store.budget.update((budget) => ({
        ...budget,
        categories: budget.categories.map((category) =>
          category.id === 'bebidas'
            ? { ...category, name: 'Buffet/Comida' }
            : category,
        ),
      }));

      store.applyPercentageProfile('padrao');

      expect(pct('bebidas')).toBe(8);
      expect(pct('buffet-comida')).toBe(30);
    });

    it('não confunde categoria personalizada com uma padrão de mesmo nome', () => {
      store.addCategory('Bebidas', 4);
      const custom = store
        .budget()
        .categories.find((category) => category.id.startsWith('bebidas-'))!;

      store.applyPercentageProfile('agressivo');

      expect(pct(custom.id)).toBe(4);
      expect(pct('bebidas')).toBe(12);
    });

    it('não recria categorias removidas', () => {
      store.removeCategory('bebidas');
      const total = store.budget().categories.length;

      store.applyPercentageProfile('agressivo');

      expect(store.budget().categories.length).toBe(total);
      expect(pct('bebidas')).toBeUndefined();
    });

    it('calcula a soma que o perfil produz sem aplicá-lo', () => {
      store.addCategory('Transporte', 4);

      expect(store.profileTotal('agressivo')).toBe(104);
      expect(pct('buffet-comida')).toBe(30);
    });

    it('ignora perfil inexistente', () => {
      store.applyPercentageProfile('inexistente');

      expect(pct('buffet-comida')).toBe(30);
    });

    it('salva o orçamento no servidor', fakeAsync(() => {
      api.updateBudget.and.callFake((budget) =>
        of({ ...budget, expenses: [] }),
      );

      store.applyPercentageProfile('basico');
      tick(500);

      const saved = api.updateBudget.calls.mostRecent().args[0];
      expect(
        saved.categories.find((category) => category.id === 'buffet-comida')
          ?.suggestedPct,
      ).toBe(35);
    }));
  });
});
