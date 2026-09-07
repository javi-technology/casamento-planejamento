import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from './core/api.service';
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
});
