import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { BudgetStore, createDefaultBudget } from './budget-store.service';
import { ApiService } from './core/api.service';
import { AuthService } from './core/auth.service';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let root: HTMLElement;

  const tab = (name: string): HTMLButtonElement | undefined =>
    Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        'nav[aria-label="Seções do planejamento"] button',
      ),
    ).find((button) => button.textContent?.trim() === name);
  const visible = (selector: string): boolean => {
    const element = root.querySelector<HTMLElement>(selector);
    return !!element && element.offsetParent !== null;
  };

  beforeEach(() => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['getBudget']);
    api.getBudget.and.returnValue(of(createDefaultBudget()));
    const auth = {
      email: signal<string | null>('noiva@example.com'),
      ready: signal(true),
      error: signal(''),
      loading: signal(false),
    };
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    });
    fixture = TestBed.createComponent(AppComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  afterEach(() => fixture.nativeElement.remove());

  it('exibe a seção de fornecedores antes da de categorias', () => {
    const expenses = root.querySelector('app-expense-section');
    const categories = root.querySelector('app-category-table');

    expect(expenses).not.toBeNull();
    expect(categories).not.toBeNull();
    expect(
      expenses!.compareDocumentPosition(categories!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('exibe as abas Orçamento e Convidados com Orçamento selecionada', () => {
    expect(tab('Orçamento')?.getAttribute('aria-current')).toBe('true');
    expect(tab('Convidados')?.hasAttribute('aria-current')).toBeFalse();
    expect(visible('app-expense-section')).toBeTrue();
    expect(visible('[data-guests-tab]')).toBeFalse();
  });

  it('não anuncia semântica de abas que não implementa', () => {
    expect(root.querySelector('[role="tablist"], [role="tab"]')).toBeNull();
  });

  it('mostra a aba Convidados e esconde o orçamento ao trocar de aba', () => {
    tab('Convidados')!.click();
    fixture.detectChanges();

    expect(tab('Convidados')?.getAttribute('aria-current')).toBe('true');
    expect(tab('Orçamento')?.hasAttribute('aria-current')).toBeFalse();
    expect(visible('[data-guests-tab]')).toBeTrue();
    expect(visible('app-expense-section')).toBeFalse();
    expect(visible('app-category-table')).toBeFalse();
  });

  it('mantém o estado do orçamento ao voltar para a aba Orçamento', () => {
    const store = TestBed.inject(BudgetStore);
    store.updateParameters({ guests: 123 });
    const input = root.querySelector<HTMLInputElement>('input[type="number"]')!;

    tab('Convidados')!.click();
    fixture.detectChanges();
    tab('Orçamento')!.click();
    fixture.detectChanges();

    expect(visible('app-expense-section')).toBeTrue();
    expect(root.querySelector('input[type="number"]')).toBe(input);
    expect(store.budget().guests).toBe(123);
  });
});
