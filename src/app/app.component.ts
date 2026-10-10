import { CommonModule, CurrencyPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BudgetStore } from './budget-store.service';
import { CategoryTableComponent } from './components/category-table.component';
import { ExpenseSectionComponent } from './components/expense-section.component';
import { AuthService } from './core/auth.service';
import { WeddingBudget } from './models';

export type AppTab = 'budget' | 'guests';
export type AuthMode = 'login' | 'signup';

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
  readonly tabs: { id: AppTab; label: string }[] = [
    { id: 'budget', label: 'Orçamento' },
    { id: 'guests', label: 'Convidados' },
  ];
  readonly activeTab = signal<AppTab>('budget');
  readonly authMode = signal<AuthMode>('login');
  loginForm = { email: '', password: '' };
  signupForm = { name: '', email: '', password: '', inviteCode: '' };
  showClearConfirmation = false;
  importError = '';

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) {
        void this.store.load(user.id);
      }
    });
  }

  async submitLogin(): Promise<void> {
    const { email, password } = this.loginForm;
    if (!email.trim() || !password) {
      return;
    }
    await this.auth.login(email, password);
  }

  async submitSignup(): Promise<void> {
    await this.auth.signup({ ...this.signupForm });
  }

  retryLoadUser(): Promise<void> {
    return this.auth.retry();
  }

  switchAuthMode(mode: AuthMode): void {
    this.authMode.set(mode);
    this.auth.error.set('');
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
