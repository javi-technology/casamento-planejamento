import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BudgetStore } from '../budget-store.service';
import { ApiService } from '../core/api.service';
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
  readonly api = inject(ApiService);
  readonly newExpense = emptyDraft();
  filterCategory = '';
  editingId: string | null = null;
  editDraft = emptyDraft();
  uploadingId: string | null = null;
  expensePendingDeletion: string | null = null;
  contractPendingDeletion: string | null = null;
  contractError = '';

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
    this.expensePendingDeletion = id;
  }

  confirmDeleteExpense(): void {
    if (this.expensePendingDeletion) {
      this.store.deleteExpense(this.expensePendingDeletion);
      this.expensePendingDeletion = null;
    }
  }

  uploadContract(id: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (file.type !== 'application/pdf') {
      this.contractError = 'Selecione um arquivo PDF.';
      return;
    }

    this.contractError = '';
    this.uploadingId = id;
    this.api.uploadContract(id, file).subscribe({
      next: ({ contract }) => {
        const expense = this.store
          .budget()
          .expenses.find((item) => item.id === id);
        if (expense) {
          this.store.applyExpense({ ...expense, contract });
        }
        this.uploadingId = null;
      },
      error: () => {
        this.contractError = 'Não foi possível anexar o contrato.';
        this.uploadingId = null;
      },
    });
  }

  viewContract(id: string): void {
    this.api.openContract(id);
  }

  requestRemoveContract(id: string): void {
    this.contractPendingDeletion = id;
  }

  confirmRemoveContract(): void {
    const id = this.contractPendingDeletion;
    if (!id) {
      return;
    }
    this.api.deleteContract(id).subscribe({
      next: () => {
        const expense = this.store
          .budget()
          .expenses.find((item) => item.id === id);
        if (expense) {
          this.store.applyExpense({ ...expense, contract: undefined });
        }
        this.contractPendingDeletion = null;
      },
      error: () => {
        this.contractError = 'Não foi possível remover o contrato.';
        this.contractPendingDeletion = null;
      },
    });
  }

  contractSize(size: number): string {
    if (size < 1024 * 1024) {
      return `${Math.max(1, Math.round(size / 1024))} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private parseNumber(value: string): number {
    return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
  }
}
