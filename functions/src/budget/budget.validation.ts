import { Category, Expense, WeddingBudget } from './types';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateBudgetInput(
  value: unknown,
  requireExpenses = false,
): ValidationError[] {
  const input = value as Partial<WeddingBudget> | null;
  const errors: ValidationError[] = [];
  const guests = input?.guests;

  if (typeof guests !== 'number' || !Number.isInteger(guests) || guests < 1) {
    errors.push({
      field: 'guests',
      message: 'Deve ser um inteiro maior ou igual a 1',
    });
  }
  if (!input || !isNonNegativeNumber(input.maxBudget)) {
    errors.push({
      field: 'maxBudget',
      message: 'Deve ser um número finito maior ou igual a 0',
    });
  }
  if (!input || !Array.isArray(input.categories)) {
    errors.push({
      field: 'categories',
      message: 'Deve ser uma lista de categorias',
    });
  } else {
    input.categories.forEach((category, index) => {
      if (
        !category ||
        typeof category.id !== 'string' ||
        typeof category.name !== 'string'
      ) {
        errors.push({
          field: `categories[${index}]`,
          message: 'Categoria inválida',
        });
      }
      if (!category || !isNonNegativeNumber(category.suggestedPct)) {
        errors.push({
          field: `categories[${index}].suggestedPct`,
          message: 'Deve ser um número finito maior ou igual a 0',
        });
      }
    });
  }
  if (requireExpenses) {
    if (!input || !Array.isArray(input.expenses)) {
      errors.push({
        field: 'expenses',
        message: 'Deve ser uma lista de despesas',
      });
    } else {
      input.expenses.forEach((expense, index) => {
        errors.push(...validateExpense(expense, `expenses[${index}]`));
      });
    }
  }

  return errors;
}

export function validateExpense(
  value: unknown,
  prefix = '',
): ValidationError[] {
  const expense = value as Partial<Expense> | null;
  const errors: ValidationError[] = [];
  const field = (name: string) => (prefix ? `${prefix}.${name}` : name);

  if (
    !expense ||
    typeof expense.categoryId !== 'string' ||
    !expense.categoryId.trim()
  ) {
    errors.push({
      field: field('categoryId'),
      message: 'Categoria é obrigatória',
    });
  }
  if (
    !expense ||
    typeof expense.supplier !== 'string' ||
    !expense.supplier.trim() ||
    expense.supplier.length > 120
  ) {
    errors.push({
      field: field('supplier'),
      message: 'Fornecedor é obrigatório e deve ter até 120 caracteres',
    });
  }
  for (const amount of ['estimated', 'contracted', 'paid'] as const) {
    if (!expense || !isNonNegativeNumber(expense[amount])) {
      errors.push({
        field: field(amount),
        message: 'Deve ser um número finito maior ou igual a 0',
      });
    }
  }
  return errors;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
