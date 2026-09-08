import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export const EMAIL_STORAGE_KEY = 'casamento-gastos:email';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  readonly email = signal(this.readStoredEmail());
  readonly ready = signal(true);
  readonly unauthorized = signal(false);
  readonly error = signal('');
  readonly loading = signal(false);

  async login(value: string): Promise<boolean> {
    const email = value.trim().toLowerCase();
    this.loading.set(true);
    this.error.set('');
    this.unauthorized.set(false);

    try {
      const response = await firstValueFrom(this.api.login(email));
      this.email.set(response.email);
      this.storeEmail(response.email);
      return true;
    } catch (error) {
      const httpError = error as HttpErrorResponse;
      if (httpError.status === 403) {
        this.unauthorized.set(true);
        this.error.set('Este e-mail não está autorizado');
      } else if (httpError.status === 400) {
        this.error.set(httpError.error?.message ?? 'Informe um e-mail válido');
      } else {
        this.error.set('Não foi possível entrar. Tente novamente.');
      }
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.clearStoredEmail();
    this.unauthorized.set(false);
    this.error.set('');
  }

  markUnauthorized(): void {
    this.unauthorized.set(true);
    this.clearStoredEmail();
  }

  clearStoredEmail(): void {
    this.removeStoredEmail();
    this.email.set(null);
  }

  private readStoredEmail(): string | null {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage.getItem(EMAIL_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private storeEmail(email: string): void {
    try {
      localStorage.setItem(EMAIL_STORAGE_KEY, email);
    } catch {}
  }

  private removeStoredEmail(): void {
    try {
      localStorage.removeItem(EMAIL_STORAGE_KEY);
    } catch {}
  }
}
