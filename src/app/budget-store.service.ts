import { Injectable, computed, effect, signal } from '@angular/core';
import {
  Category,
  CategorySummary,
  DEFAULT_CATEGORIES,
  Expense,
  WeddingBudget,
} from './models';

export const STORAGE_KEY = 'casamento-gastos:v1';

const initialBudget = (): WeddingBudget => ({
  guests: 100,
  maxBudget: 50_000,
  categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
  expenses: [],
});

@Injectable({ providedIn: 'root' })
export class BudgetStore {
  readonly budget = signal<WeddingBudget>(this.load());

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

  constructor() {
    effect(() => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.budget()));
      }
    });
  }

  updateParameters(
    changes: Partial<Pick<WeddingBudget, 'guests' | 'maxBudget'>>,
  ): void {
    this.update((budget) => ({ ...budget, ...changes }));
  }

  updateCategory(id: string, changes: Partial<Category>): void {
    this.update((budget) => ({
      ...budget,
      categories: budget.categories.map((category) =>
        category.id === id ? { ...category, ...changes } : category,
      ),
    }));
  }

  addCategory(name: string, suggestedPct = 0, perGuest = false): void {
    const id = `${name
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${Date.now()}`;
    this.update((budget) => ({
      ...budget,
      categories: [
        ...budget.categories,
        { id, name: name.trim(), suggestedPct, perGuest },
      ],
    }));
  }

  addExpense(expense: Omit<Expense, 'id'>): void {
    this.update((budget) => ({
      ...budget,
      expenses: [...budget.expenses, { ...expense, id: crypto.randomUUID() }],
    }));
  }

  updateExpense(id: string, changes: Partial<Expense>): void {
    this.update((budget) => ({
      ...budget,
      expenses: budget.expenses.map((expense) =>
        expense.id === id ? { ...expense, ...changes } : expense,
      ),
    }));
  }

  deleteExpense(id: string): void {
    this.update((budget) => ({
      ...budget,
      expenses: budget.expenses.filter((expense) => expense.id !== id),
    }));
  }

  replaceBudget(budget: WeddingBudget): void {
    this.budget.set(this.sanitize(budget));
  }

  clear(): void {
    this.budget.set(initialBudget());
  }

  private update(updater: (budget: WeddingBudget) => WeddingBudget): void {
    this.budget.update(updater);
  }

  private load(): WeddingBudget {
    if (typeof localStorage === 'undefined') {
      return initialBudget();
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored
        ? this.sanitize(JSON.parse(stored) as WeddingBudget)
        : initialBudget();
    } catch {
      return initialBudget();
    }
  }

  private sanitize(value: WeddingBudget): WeddingBudget {
    const fallback = initialBudget();
    return {
      guests:
        Number.isFinite(value?.guests) && value.guests > 0
          ? value.guests
          : fallback.guests,
      maxBudget:
        Number.isFinite(value?.maxBudget) && value.maxBudget >= 0
          ? value.maxBudget
          : fallback.maxBudget,
      categories: Array.isArray(value?.categories)
        ? value.categories
        : fallback.categories,
      expenses: Array.isArray(value?.expenses) ? value.expenses : [],
    };
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
