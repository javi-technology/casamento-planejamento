import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BudgetStore, createDefaultBudget } from '../budget-store.service';
import { ApiService } from '../core/api.service';
import { Expense } from '../models';
import { ExpenseSectionComponent } from './expense-section.component';

describe('ExpenseSectionComponent - upload de contrato', () => {
  let component: ExpenseSectionComponent;
  let api: jasmine.SpyObj<ApiService>;

  const selectFile = (file: File): Event =>
    ({ target: { files: [file], value: 'c:\\fakepath' } }) as unknown as Event;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'uploadContract',
      'updateBudget',
    ]);
    TestBed.configureTestingModule({
      imports: [ExpenseSectionComponent],
      providers: [{ provide: ApiService, useValue: api }],
    });
    component = TestBed.createComponent(
      ExpenseSectionComponent,
    ).componentInstance;
  });

  it('envia PDF com tipo vazio quando a extensão é .pdf', () => {
    api.uploadContract.and.returnValue(
      of({
        contract: {
          path: 'p',
          fileName: 'contrato.pdf',
          contentType: 'application/pdf',
          size: 1,
          uploadedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    );

    component.uploadContract(
      'exp-1',
      selectFile(new File(['%PDF'], 'Contrato.PDF', { type: '' })),
    );

    expect(api.uploadContract).toHaveBeenCalled();
    expect(component.contractError).toBe('');
  });

  it('envia PDF identificado com tipo genérico quando a extensão é .pdf', () => {
    api.uploadContract.and.returnValue(of({ contract: {} as never }));

    component.uploadContract(
      'exp-1',
      selectFile(
        new File(['%PDF'], 'contrato.pdf', {
          type: 'application/octet-stream',
        }),
      ),
    );

    expect(api.uploadContract).toHaveBeenCalled();
    expect(component.contractError).toBe('');
  });

  it('rejeita arquivo que não é PDF sem chamar a API', () => {
    component.uploadContract(
      'exp-1',
      selectFile(new File(['x'], 'foto.png', { type: 'image/png' })),
    );

    expect(api.uploadContract).not.toHaveBeenCalled();
    expect(component.contractError).toBe('Selecione um arquivo PDF.');
  });

  it('rejeita PDF acima de 10 MB sem chamar a API', () => {
    const big = new File([new ArrayBuffer(10 * 1024 * 1024 + 1)], 'c.pdf', {
      type: 'application/pdf',
    });

    component.uploadContract('exp-1', selectFile(big));

    expect(api.uploadContract).not.toHaveBeenCalled();
    expect(component.contractError).toBe(
      'O contrato deve ter no máximo 10 MB.',
    );
  });

  it('exibe a mensagem devolvida pela API quando o upload falha', () => {
    api.uploadContract.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'Apenas arquivos PDF são aceitos' },
          }),
      ),
    );

    component.uploadContract(
      'exp-1',
      selectFile(new File(['%PDF'], 'c.pdf', { type: 'application/pdf' })),
    );

    expect(component.contractError).toBe('Apenas arquivos PDF são aceitos');
    expect(component.uploadingId).toBeNull();
  });

  it('usa mensagem genérica quando a API não detalha o erro', () => {
    api.uploadContract.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    component.uploadContract(
      'exp-1',
      selectFile(new File(['%PDF'], 'c.pdf', { type: 'application/pdf' })),
    );

    expect(component.contractError).toBe('Não foi possível anexar o contrato.');
  });
});

describe('ExpenseSectionComponent - layout da lista', () => {
  let fixture: ComponentFixture<ExpenseSectionComponent>;
  let store: BudgetStore;

  const rows = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-expense-row]'));

  beforeEach(() => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', [
      'updateBudget',
    ]);
    api.updateBudget.and.returnValue(of(createDefaultBudget()));
    TestBed.configureTestingModule({
      imports: [ExpenseSectionComponent],
      providers: [{ provide: ApiService, useValue: api }],
    });
    store = TestBed.inject(BudgetStore);
    const budget = createDefaultBudget();
    const expenses: Expense[] = [
      {
        id: 'e1',
        categoryId: budget.categories[0].id,
        supplier: 'Nathalia Alves',
        description: 'Ensaio Pré-Wedding',
        estimated: 1000,
        contracted: 1000,
        paid: 1000,
        contract: {
          path: 'p',
          fileName: 'Ensaio.pdf',
          contentType: 'application/pdf',
          size: 1,
          uploadedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      {
        id: 'e2',
        categoryId: budget.categories[1].id,
        supplier: 'Casa 28',
        estimated: 40000,
        contracted: 37620,
        paid: 0,
      },
    ];
    store.budget.set({ ...budget, expenses });
    fixture = TestBed.createComponent(ExpenseSectionComponent);
    fixture.detectChanges();
  });

  it('usa a mesma definição de colunas em todas as linhas', () => {
    const templates = rows().map((row) =>
      Array.from(row.classList).filter((c) => c.startsWith('lg:grid-cols-')),
    );

    expect(templates.length).toBe(2);
    expect(templates[0].length).toBe(1);
    expect(templates[1]).toEqual(templates[0]);
  });

  it('mantém uma célula por coluna, com ou sem contrato anexado', () => {
    expect(rows().length).toBe(2);
    for (const row of rows()) {
      const columns = Array.from(row.querySelectorAll('[data-column]')).map(
        (cell) => cell.getAttribute('data-column'),
      );

      expect(columns).toEqual([
        'supplier',
        'estimated',
        'contracted',
        'paid',
        'contract',
        'actions',
      ]);
    }
  });

  it('exibe a etiqueta de categoria sem cores de erro (blush/rose)', () => {
    const badges = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('[data-category-badge]'),
    );

    expect(badges.length).toBe(2);
    for (const badge of badges) {
      expect(badge.className).not.toMatch(/blush|rose|red/);
    }
  });

  describe('com valores altos e nomes longos', () => {
    const LONG_NAME =
      'Cerimonial e Assessoria de Eventos Maria das Graças Oliveira & Filhos';

    beforeEach(() => {
      const budget = store.budget();
      store.budget.set({
        ...budget,
        expenses: [
          {
            ...budget.expenses[1],
            supplier: LONG_NAME,
            estimated: 100000000,
            contracted: 100000000,
            paid: 100000000,
          },
        ],
      });
      fixture.detectChanges();
    });

    it('não corta o nome do fornecedor com reticências', () => {
      const name = fixture.nativeElement.querySelector(
        '[data-column="supplier"] h3',
      ) as HTMLElement;
      const style = getComputedStyle(name);

      expect(name.textContent).toContain(LONG_NAME);
      expect(style.textOverflow).not.toBe('ellipsis');
      expect(style.overflowWrap).toBe('break-word');
    });

    it('mantém cada valor monetário em uma linha, com o valor completo', () => {
      for (const column of ['estimated', 'contracted', 'paid']) {
        const value = fixture.nativeElement.querySelector(
          `[data-column="${column}"] [data-value]`,
        ) as HTMLElement;

        expect(getComputedStyle(value).whiteSpace).toBe('nowrap');
        expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth);
      }
    });

    it('oferece o texto completo nos campos que podem ser truncados', () => {
      const description = fixture.nativeElement.querySelector(
        '[data-column="supplier"] p',
      ) as HTMLElement;
      const badge = fixture.nativeElement.querySelector(
        '[data-category-badge]',
      ) as HTMLElement;

      expect(description.title).toBe((description.textContent ?? '').trim());
      expect(badge.title).toBe((badge.textContent ?? '').trim());
    });
  });
});
