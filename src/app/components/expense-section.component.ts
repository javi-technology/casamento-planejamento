import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BudgetStore } from '../budget-store.service';
import { Expense } from '../models';

interface ExpenseDraft {
  categoryId: string;
  supplier: string;
  description: string;
  estimated: string;
  contracted: string;
  paid: string;
}

const emptyDraft = (): ExpenseDraft => ({
  categoryId: '',
  supplier: '',
  description: '',
  estimated: '',
  contracted: '',
  paid: '',
});

@Component({
  selector: 'app-expense-section',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, FormsModule],
  templateUrl: './expense-section.component.html',
})
export class ExpenseSectionComponent {
  readonly store = inject(BudgetStore);
  readonly newExpense = emptyDraft();
  filterCategory = '';
  editingId: string | null = null;
  editDraft = emptyDraft();

  get filteredExpenses(): Expense[] {
    const expenses = this.store.budget().expenses;
    return this.filterCategory
      ? expenses.filter((expense) => expense.categoryId === this.filterCategory)
      : expenses;
  }

  categoryName(id: string): string {
    return (
      this.store.budget().categories.find((category) => category.id === id)
        ?.name ?? 'Sem categoria'
    );
  }

  addExpense(): void {
    if (!this.newExpense.categoryId || !this.newExpense.supplier.trim()) {
      return;
    }

    this.store.addExpense({
      categoryId: this.newExpense.categoryId,
      supplier: this.newExpense.supplier.trim(),
      description: this.newExpense.description.trim() || undefined,
      estimated: this.parseNumber(this.newExpense.estimated),
      contracted: this.parseNumber(this.newExpense.contracted),
      paid: this.parseNumber(this.newExpense.paid),
    });
    Object.assign(this.newExpense, emptyDraft());
  }

  startEdit(expense: Expense): void {
    this.editingId = expense.id;
    this.editDraft = {
      categoryId: expense.categoryId,
      supplier: expense.supplier,
      description: expense.description ?? '',
      estimated: String(expense.estimated),
      contracted: String(expense.contracted),
      paid: String(expense.paid),
    };
  }

  saveEdit(): void {
    if (!this.editingId || !this.editDraft.supplier.trim()) {
      return;
    }

    this.store.updateExpense(this.editingId, {
      categoryId: this.editDraft.categoryId,
      supplier: this.editDraft.supplier.trim(),
      description: this.editDraft.description.trim() || undefined,
      estimated: this.parseNumber(this.editDraft.estimated),
      contracted: this.parseNumber(this.editDraft.contracted),
      paid: this.parseNumber(this.editDraft.paid),
    });
    this.cancelEdit();
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editDraft = emptyDraft();
  }

  deleteExpense(id: string): void {
    if (window.confirm('Remover este fornecedor?')) {
      this.store.deleteExpense(id);
    }
  }

  private parseNumber(value: string): number {
    return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
  }
}
