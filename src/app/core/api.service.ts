import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Expense, WeddingBudget } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  login(email: string): Observable<{ email: string }> {
    return this.http.post<{ email: string }>('/api/login', { email });
  }

  getMe(): Observable<{ email: string }> {
    return this.http.get<{ email: string }>('/api/me');
  }

  getBudget(): Observable<WeddingBudget> {
    return this.http.get<WeddingBudget>('/api/budget');
  }

  updateBudget(
    budget: Pick<WeddingBudget, 'guests' | 'maxBudget' | 'categories'>,
  ): Observable<WeddingBudget> {
    return this.http.put<WeddingBudget>('/api/budget', budget);
  }

  importBudget(budget: WeddingBudget): Observable<WeddingBudget> {
    return this.http.post<WeddingBudget>('/api/budget/import', budget);
  }

  createExpense(expense: Omit<Expense, 'id'>): Observable<Expense> {
    return this.http.post<Expense>('/api/expenses', expense);
  }

  updateExpense(id: string, changes: Partial<Expense>): Observable<Expense> {
    return this.http.put<Expense>(`/api/expenses/${id}`, changes);
  }

  deleteExpense(id: string): Observable<void> {
    return this.http.delete<void>(`/api/expenses/${id}`);
  }

  uploadContract(
    id: string,
    file: File,
  ): Observable<{ contract: NonNullable<Expense['contract']> }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<{ contract: NonNullable<Expense['contract']> }>(
      `/api/expenses/${id}/contract`,
      formData,
    );
  }

  downloadContract(id: string): Observable<Blob> {
    return this.http.get(`/api/expenses/${id}/contract`, {
      responseType: 'blob',
    });
  }

  deleteContract(id: string): Observable<void> {
    return this.http.delete<void>(`/api/expenses/${id}/contract`);
  }

  openContract(id: string): void {
    this.downloadContract(id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }
}
