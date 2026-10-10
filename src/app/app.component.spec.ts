import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { BudgetStore, createDefaultBudget } from './budget-store.service';
import { ApiService } from './core/api.service';
import { AuthService } from './core/auth.service';
import { User } from './models';

const MARIA: User = { id: 'uid-maria', name: 'Maria', email: 'maria@x.com' };

function fakeAuth(user: User | null) {
  return {
    user: signal<User | null>(user),
    ready: signal(true),
    error: signal(''),
    loading: signal(false),
    canRetry: signal(false),
    retry: jasmine.createSpy('retry').and.resolveTo(),
    login: jasmine.createSpy('login').and.resolveTo(true),
    signup: jasmine.createSpy('signup').and.resolveTo(true),
    logout: jasmine.createSpy('logout').and.resolveTo(),
  };
}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let root: HTMLElement;
  let auth: ReturnType<typeof fakeAuth>;

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
    api.getBudget.and.returnValue(
      of({ ...createDefaultBudget(), users: [MARIA] }),
    );
    auth = fakeAuth(MARIA);
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

  it('exibe o nome do usuário no cabeçalho em vez do e-mail', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const header = root.querySelector('header')!;

    expect(header.textContent).toContain('Maria');
    expect(header.textContent).not.toContain('maria@x.com');
  });

  it('sai pela sessão do Firebase ao clicar em Sair', () => {
    const sair = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Sair',
    )!;

    sair.click();

    expect(auth.logout).toHaveBeenCalled();
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

describe('AppComponent sem sessão', () => {
  let fixture: ComponentFixture<AppComponent>;
  let root: HTMLElement;
  let auth: ReturnType<typeof fakeAuth>;

  const input = (name: string) =>
    root.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  const fill = async (values: Record<string, string>) => {
    for (const [name, value] of Object.entries(values)) {
      const field = input(name)!;
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const submit = () =>
    root
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit'));
  const button = (text: string) =>
    Array.from(root.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === text,
    );

  beforeEach(async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['getBudget']);
    auth = fakeAuth(null);
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    });
    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    root = fixture.nativeElement;
  });

  it('pede e-mail e senha para entrar', async () => {
    expect(input('password')?.type).toBe('password');

    await fill({ email: 'maria@x.com', password: 'segredo123' });
    submit();

    expect(auth.login).toHaveBeenCalledWith('maria@x.com', 'segredo123');
  });

  it('alterna para o cadastro com nome, e-mail, senha e convite', async () => {
    button('Criar conta')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    await fill({
      name: 'Maria',
      email: 'maria@x.com',
      password: 'segredo123',
      inviteCode: 'convite',
    });
    submit();

    expect(auth.signup).toHaveBeenCalledWith({
      name: 'Maria',
      email: 'maria@x.com',
      password: 'segredo123',
      inviteCode: 'convite',
    });
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('volta do cadastro para o login', () => {
    button('Criar conta')!.click();
    fixture.detectChanges();
    button('Já tenho conta')!.click();
    fixture.detectChanges();

    expect(input('inviteCode')).toBeNull();
    expect(input('password')).not.toBeNull();
  });

  it('oferece tentar novamente quando o usuário não pôde ser carregado', () => {
    expect(button('Tentar novamente')).toBeUndefined();

    auth.error.set('Não foi possível carregar seu usuário. Tente novamente.');
    auth.canRetry.set(true);
    fixture.detectChanges();
    button('Tentar novamente')!.click();

    expect(auth.retry).toHaveBeenCalled();
  });

  it('exibe o erro de autenticação', () => {
    auth.error.set('E-mail ou senha inválidos');
    fixture.detectChanges();

    expect(root.textContent).toContain('E-mail ou senha inválidos');
  });
});
