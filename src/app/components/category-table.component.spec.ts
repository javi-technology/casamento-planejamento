import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BudgetStore, createDefaultBudget } from '../budget-store.service';
import { ApiService } from '../core/api.service';
import { CategoryTableComponent } from './category-table.component';

describe('CategoryTableComponent', () => {
  let fixture: ComponentFixture<CategoryTableComponent>;
  let store: BudgetStore;

  const selects = (): HTMLSelectElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('select[data-responsible]'),
    );

  beforeEach(() => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', [
      'updateBudget',
    ]);
    api.updateBudget.and.returnValue(of({ ...createDefaultBudget() }));
    TestBed.configureTestingModule({
      imports: [CategoryTableComponent],
      providers: [{ provide: ApiService, useValue: api }],
    });
    store = TestBed.inject(BudgetStore);
    store.responsibles.set(['noiva@example.com', 'noivo@example.com']);
    fixture = TestBed.createComponent(CategoryTableComponent);
    fixture.detectChanges();
  });

  it('exibe a coluna Responsável com um seletor por categoria', () => {
    expect(fixture.nativeElement.textContent).toContain('Responsável');
    expect(selects().length).toBe(store.budget().categories.length);
  });

  it('oferece "Sem responsável" e os noivos como opções', () => {
    const labels = Array.from(selects()[0].options).map((o) => o.text.trim());

    expect(labels).toEqual([
      'Sem responsável',
      'noiva@example.com',
      'noivo@example.com',
    ]);
  });

  it('exibe o nome do responsável e grava o e-mail', () => {
    store.userNames.set({ 'noiva@example.com': 'Maria' });
    fixture.detectChanges();
    const options = Array.from(selects()[0].options);

    expect(options.map((o) => o.text.trim())).toEqual([
      'Sem responsável',
      'Maria',
      'noivo@example.com',
    ]);
    expect(options[1].value).toContain('noiva@example.com');
  });

  it('atribui o responsável escolhido à categoria', () => {
    const select = selects()[0];
    select.value = 'noivo@example.com';
    select.dispatchEvent(new Event('change'));

    expect(store.budget().categories[0].responsible).toBe('noivo@example.com');
  });

  it('remove o responsável ao escolher "Sem responsável"', () => {
    store.updateCategory(store.budget().categories[0].id, {
      responsible: 'noiva@example.com',
    });
    fixture.detectChanges();
    const select = selects()[0];
    select.value = '';
    select.dispatchEvent(new Event('change'));

    expect(store.budget().categories[0].responsible).toBeUndefined();
  });
});
