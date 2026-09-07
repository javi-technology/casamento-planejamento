import { TestBed } from '@angular/core/testing';
import { BudgetStore, STORAGE_KEY } from './budget-store.service';

describe('BudgetStore', () => {
  let store: BudgetStore;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [BudgetStore] });
    store = TestBed.inject(BudgetStore);
    TestBed.flushEffects();
  });

  it('calcula os totais de estimado, contratado e pago', () => {
    const categoryId = store.budget().categories[0].id;
    store.addExpense({
      categoryId,
      supplier: 'Fornecedor A',
      estimated: 1000,
      contracted: 800,
      paid: 300,
    });
    store.addExpense({
      categoryId,
      supplier: 'Fornecedor B',
      estimated: 500,
      contracted: 400,
      paid: 200,
    });

    expect(store.totalEstimated()).toBe(1500);
    expect(store.totalContracted()).toBe(1200);
    expect(store.totalPaid()).toBe(500);
    expect(store.remaining()).toBe(48_800);
  });

  it('agrega valores por categoria e calcula a diferença', () => {
    const [first, second] = store.budget().categories;
    store.addExpense({
      categoryId: first.id,
      supplier: 'Espaço',
      estimated: 10_000,
      contracted: 8_000,
      paid: 2_000,
    });
    store.addExpense({
      categoryId: second.id,
      supplier: 'Buffet',
      estimated: 20_000,
      contracted: 15_000,
      paid: 5_000,
    });

    const summary = store.categorySummaries();
    expect(summary[0].estimated).toBe(10_000);
    expect(summary[0].contracted).toBe(8_000);
    expect(summary[0].paid).toBe(2_000);
    expect(summary[0].suggested).toBe(7500);
    expect(summary[0].difference).toBe(-500);
    expect(summary[1].contracted).toBe(15_000);
  });

  it('calcula o orçamento sugerido por convidado', () => {
    store.updateParameters({ guests: 150, maxBudget: 60_000 });
    const buffet = store
      .categorySummaries()
      .find((category) => category.id === 'buffet-comida');

    expect(buffet?.suggested).toBe(18_000);
    expect(buffet?.perGuestAmount).toBe(120);
  });

  it('persiste alterações e carrega os dados salvos', () => {
    store.updateParameters({ guests: 180, maxBudget: 75_000 });
    TestBed.flushEffects();

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(persisted.guests).toBe(180);
    expect(persisted.maxBudget).toBe(75_000);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [BudgetStore] });
    const reloaded = TestBed.inject(BudgetStore);
    expect(reloaded.budget().guests).toBe(180);
    expect(reloaded.budget().maxBudget).toBe(75_000);
  });
});
