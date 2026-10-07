import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { createDefaultBudget } from './budget-store.service';
import { ApiService } from './core/api.service';
import { AuthService } from './core/auth.service';

describe('AppComponent', () => {
  it('exibe a seção de fornecedores antes da de categorias', () => {
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
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const expenses = root.querySelector('app-expense-section');
    const categories = root.querySelector('app-category-table');

    expect(expenses).not.toBeNull();
    expect(categories).not.toBeNull();
    expect(
      expenses!.compareDocumentPosition(categories!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
