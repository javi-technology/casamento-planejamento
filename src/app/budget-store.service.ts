import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './core/api.service';
import {
  Category,
  CategorySummary,
  DEFAULT_CATEGORIES,
  Expense,
  WeddingBudget,
} from './models';

export const STORAGE_KEY = 'casamento-gastos:v1';

export const createDefaultBudget = (): WeddingBudget => ({
  guests: 100,
  maxBudget: 50_000,
  categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
  expenses: [],
});

@Injectable({ providedIn: 'root' })
export class BudgetStore {
  private readonly api = inject(ApiService);
  private budgetSaveTimer?: ReturnType<typeof setTimeout>;
  private loaded = false;
  private loadedUserId: string | null = null;

  readonly budget = signal<WeddingBudget>(createDefaultBudget());
  readonly saving = signal(false);
  readonly error = signal('');
  readonly migrationCandidate = signal<WeddingBudget | null>(null);

  readonly totalEstimated = computed(() =>
    this.budget().expenses.reduce(
      (total, expense) => total + expense.estimated,
      0,
    ),
  );

  readonly totalContracted = computed(() =>
    this.budget().expenses.reduce(
      (total, expense) => total + expense.contracted,
      0,
    ),
  );

  readonly totalPaid = computed(() =>
    this.budget().expenses.reduce((total, expense) => total + expense.paid, 0),
  );

  readonly remaining = computed(
    () => this.budget().maxBudget - this.totalContracted(),
  );

  readonly costPerGuest = computed(() => ({
    contracted: this.divide(this.totalContracted(), this.budget().guests),
    estimated: this.divide(this.totalEstimated(), this.budget().guests),
  }));

  readonly categorySummaries = computed<CategorySummary[]>(() => {
    const budget = this.budget();
    return budget.categories.map((category) => {
      const expenses = budget.expenses.filter(
        (expense) => expense.categoryId === category.id,
      );
      const suggested = (budget.maxBudget * category.suggestedPct) / 100;
      const contracted = this.sum(expenses, 'contracted');

      return {
        ...category,
        suggested,
        perGuestAmount: this.divide(suggested, budget.guests),
        estimated: this.sum(expenses, 'estimated'),
        contracted,
        paid: this.sum(expenses, 'paid'),
        difference: suggested - contracted,
        progress:
          suggested > 0 ? Math.min((contracted / suggested) * 100, 100) : 0,
      };
    });
  });

  readonly suggestedPctTotal = computed(() =>
    this.budget().categories.reduce(
      (total, category) => total + category.suggestedPct,
      0,
    ),
  );

  async load(userId?: string): Promise<void> {
    if (this.loaded && this.loadedUserId === (userId ?? null)) {
      return;
    }

    this.loaded = true;
    this.loadedUserId = userId ?? null;
    this.error.set('');
    try {
      const budget = await firstValueFrom(this.api.getBudget());
      this.budget.set(budget);
      if (budget.expenses.length === 0) {
        this.findMigrationCandidate();
      }
    } catch {
      this.loaded = false;
      this.loadedUserId = null;
      this.error.set('Não foi possível carregar o planejamento.');
    }
  }

  updateParameters(
    changes: Partial<Pick<WeddingBudget, 'guests' | 'maxBudget'>>,
  ): void {
    this.budget.update((budget) => ({ ...budget, ...changes }));
    this.scheduleBudgetSave();
  }

  updateCategory(id: string, changes: Partial<Category>): void {
    this.budget.update((budget) => ({
      ...budget,
      categories: budget.categories.map((category) =>
        category.id === id ? { ...category, ...changes } : category,
      ),
    }));
    this.scheduleBudgetSave();
  }

  addCategory(name: string, suggestedPct = 0, perGuest = false): void {
    const id = `${name
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${Date.now()}`;
    this.budget.update((budget) => ({
      ...budget,
      categories: [
        ...budget.categories,
        { id, name: name.trim(), suggestedPct, perGuest },
      ],
    }));
    this.scheduleBudgetSave();
  }

  addExpense(expense: Omit<Expense, 'id'>): void {
    this.saving.set(true);
    this.api.createExpense(expense).subscribe({
      next: (saved) => {
        this.budget.update((budget) => ({
          ...budget,
          expenses: [...budget.expenses, saved],
        }));
        this.saving.set(false);
      },
      error: () => this.handleError('Não foi possível adicionar o fornecedor.'),
    });
  }

  updateExpense(id: string, changes: Partial<Expense>): void {
    this.saving.set(true);
    this.api.updateExpense(id, changes).subscribe({
      next: (updated) => this.applyExpense(updated),
      error: () => this.handleError('Não foi possível atualizar o fornecedor.'),
    });
  }

  applyExpense(expense: Expense): void {
    this.budget.update((budget) => ({
      ...budget,
      expenses: budget.expenses.map((current) =>
        current.id === expense.id ? expense : current,
      ),
    }));
    this.saving.set(false);
  }

  deleteExpense(id: string): void {
    this.saving.set(true);
    this.api.deleteExpense(id).subscribe({
      next: () => {
        this.budget.update((budget) => ({
          ...budget,
          expenses: budget.expenses.filter((expense) => expense.id !== id),
        }));
        this.saving.set(false);
      },
      error: () => this.handleError('Não foi possível excluir o fornecedor.'),
    });
  }

  async replaceBudget(budget: WeddingBudget): Promise<void> {
    this.saving.set(true);
    try {
      const saved = await firstValueFrom(this.api.importBudget(budget));
      this.budget.set(saved);
      this.saving.set(false);
    } catch {
      this.handleError('Não foi possível importar o planejamento.');
    }
  }

  async clear(): Promise<void> {
    await this.replaceBudget(createDefaultBudget());
  }

  async importLegacy(): Promise<void> {
    const candidate = this.migrationCandidate();
    if (!candidate) {
      return;
    }
    this.removeLegacyData();
    this.migrationCandidate.set(null);
    await this.replaceBudget(candidate);
  }

  discardLegacy(): void {
    this.removeLegacyData();
    this.migrationCandidate.set(null);
  }

  private scheduleBudgetSave(): void {
    if (this.budgetSaveTimer) {
      clearTimeout(this.budgetSaveTimer);
    }
    this.saving.set(true);
    this.budgetSaveTimer = setTimeout(async () => {
      try {
        const saved = await firstValueFrom(
          this.api.updateBudget({
            guests: this.budget().guests,
            maxBudget: this.budget().maxBudget,
            categories: this.budget().categories,
          }),
        );
        this.budget.update((budget) => ({
          ...budget,
          guests: saved.guests,
          maxBudget: saved.maxBudget,
          categories: saved.categories,
        }));
        this.saving.set(false);
      } catch {
        this.handleError('Não foi possível salvar os parâmetros.');
      }
    }, 500);
  }

  private findMigrationCandidate(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }
    try {
      const candidate = JSON.parse(stored) as WeddingBudget;
      if (
        candidate &&
        Array.isArray(candidate.categories) &&
        Array.isArray(candidate.expenses)
      ) {
        this.migrationCandidate.set(candidate);
      }
    } catch {
      this.removeLegacyData();
    }
  }

  private removeLegacyData(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  private handleError(message: string): void {
    this.saving.set(false);
    this.error.set(message);
  }

  private sum(
    expenses: Expense[],
    field: 'estimated' | 'contracted' | 'paid',
  ): number {
    return expenses.reduce(
      (total, expense) => total + (Number(expense[field]) || 0),
      0,
    );
  }

  private divide(value: number, divisor: number): number {
    return divisor > 0 ? value / divisor : 0;
  }
}
