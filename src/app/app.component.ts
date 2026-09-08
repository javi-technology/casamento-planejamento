import { CommonModule, CurrencyPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BudgetStore } from './budget-store.service';
import { CategoryTableComponent } from './components/category-table.component';
import { ExpenseSectionComponent } from './components/expense-section.component';
import { AuthService } from './core/auth.service';
import { WeddingBudget } from './models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CategoryTableComponent,
    CommonModule,
    CurrencyPipe,
    ExpenseSectionComponent,
    FormsModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  readonly store = inject(BudgetStore);
  readonly auth = inject(AuthService);
  @ViewChild('importInput') importInput?: ElementRef<HTMLInputElement>;
  loginEmail = '';
  showClearConfirmation = false;
  importError = '';

  constructor() {
    effect(() => {
      if (this.auth.ready() && this.auth.email()) {
        void this.store.load(this.auth.email() ?? undefined);
      }
    });
  }

  async submitLogin(): Promise<void> {
    if (!this.loginEmail.trim()) {
      return;
    }
    await this.auth.login(this.loginEmail);
  }

  updateGuests(value: string | number): void {
    this.store.updateParameters({
      guests: this.parseNumber(value, false) || 1,
    });
  }

  updateMaxBudget(value: string | number): void {
    this.store.updateParameters({ maxBudget: this.parseNumber(value) });
  }

  exportJson(): void {
    const blob = new Blob([JSON.stringify(this.store.budget(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gastos-do-casamento.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  openImport(): void {
    this.importInput?.nativeElement.click();
  }

  importJson(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        void this.store.replaceBudget(
          JSON.parse(String(reader.result)) as WeddingBudget,
        );
        this.importError = '';
      } catch {
        this.importError = 'Não foi possível importar o arquivo JSON.';
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  confirmClear(): void {
    void this.store.clear();
    this.showClearConfirmation = false;
  }

  private parseNumber(value: string | number, allowThousands = true): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    const normalized = allowThousands
      ? value.replace(/\./g, '').replace(',', '.')
      : value.replace(',', '.');
    return Number(normalized) || 0;
  }
}
