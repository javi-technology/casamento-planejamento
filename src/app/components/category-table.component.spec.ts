import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BudgetStore, createDefaultBudget } from '../budget-store.service';
import { ApiService } from '../core/api.service';
import { User } from '../models';
import { CategoryTableComponent } from './category-table.component';

const MARIA: User = { id: 'uid-maria', name: 'Maria', email: 'maria@x.com' };
const JOAO: User = { id: 'uid-joao', name: 'João', email: 'joao@x.com' };

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
    store.users.set([JOAO, MARIA]);
    fixture = TestBed.createComponent(CategoryTableComponent);
    fixture.detectChanges();
  });

  it('exibe a coluna Responsável com um seletor por categoria', () => {
    expect(fixture.nativeElement.textContent).toContain('Responsável');
    expect(selects().length).toBe(store.budget().categories.length);
  });

  it('oferece "Sem responsável" e os usuários cadastrados pelo nome', () => {
    const options = Array.from(selects()[0].options);

    expect(options.map((o) => o.text.trim())).toEqual([
      'Sem responsável',
      'João',
      'Maria',
    ]);
    expect(options[2].value).toContain(MARIA.id);
  });

  it('lista um usuário novo assim que ele aparece', () => {
    store.users.set([
      JOAO,
      MARIA,
      { id: 'uid-ana', name: 'Ana', email: 'ana@x.com' },
    ]);
    fixture.detectChanges();

    expect(selects()[0].options.length).toBe(4);
  });

  it('atribui o id do usuário escolhido à categoria', () => {
    const select = selects()[0];
    select.value = select.options[2].value;
    select.dispatchEvent(new Event('change'));

    expect(store.budget().categories[0].responsible).toBe(MARIA.id);
  });

  it('remove o responsável ao escolher "Sem responsável"', () => {
    store.updateCategory(store.budget().categories[0].id, {
      responsible: MARIA.id,
    });
    fixture.detectChanges();
    const select = selects()[0];
    select.value = '';
    select.dispatchEvent(new Event('change'));

    expect(store.budget().categories[0].responsible).toBeUndefined();
  });
});
