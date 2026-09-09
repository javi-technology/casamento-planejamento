import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BudgetStore } from '../budget-store.service';

@Component({
  selector: 'app-category-table',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, FormsModule],
  templateUrl: './category-table.component.html',
})
export class CategoryTableComponent {
  readonly store = inject(BudgetStore);
  showAddForm = false;
  newCategoryName = '';
  newCategoryPct = 0;
  newCategoryPerGuest = false;
  categoryPendingDeletion: string | null = null;

  get pendingCategoryName(): string {
    return (
      this.store
        .budget()
        .categories.find(
          (category) => category.id === this.categoryPendingDeletion,
        )?.name ?? ''
    );
  }

  removeCategory(id: string): void {
    this.categoryPendingDeletion = id;
  }

  confirmRemoveCategory(): void {
    if (this.categoryPendingDeletion) {
      this.store.removeCategory(this.categoryPendingDeletion);
    }
    this.categoryPendingDeletion = null;
  }

  addCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name) {
      return;
    }

    this.store.addCategory(
      name,
      Number(this.newCategoryPct) || 0,
      this.newCategoryPerGuest,
    );
    this.newCategoryName = '';
    this.newCategoryPct = 0;
    this.newCategoryPerGuest = false;
    this.showAddForm = false;
  }

  updatePct(id: string, value: string | number): void {
    this.store.updateCategory(id, { suggestedPct: this.parseNumber(value) });
  }

  updatePerGuest(id: string, value: boolean): void {
    this.store.updateCategory(id, { perGuest: value });
  }

  private parseNumber(value: string | number): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    return Number(value.replace(',', '.')) || 0;
  }
}
