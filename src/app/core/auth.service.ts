import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SignupInput, User } from '../models';
import { ApiService } from './api.service';
import { AuthUser, FirebaseAuthClient } from './firebase-auth.client';

const INVALID_CREDENTIAL_CODES = [
  'auth/invalid-credential',
  'auth/invalid-email',
  'auth/user-not-found',
  'auth/wrong-password',
];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly client = inject(FirebaseAuthClient);
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);
  readonly error = signal('');
  readonly loading = signal(false);

  constructor() {
    this.client.onUserChanged((authUser) => void this.syncUser(authUser));
  }

  async login(email: string, password: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.client.signIn(email.trim().toLowerCase(), password);
      return true;
    } catch (error) {
      this.error.set(loginErrorMessage(error));
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async signup(input: SignupInput): Promise<boolean> {
    const email = input.email.trim().toLowerCase();
    this.loading.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.api.signup({ ...input, name: input.name.trim(), email }),
      );
    } catch (error) {
      this.error.set(signupErrorMessage(error as HttpErrorResponse));
      this.loading.set(false);
      return false;
    }
    return this.login(email, input.password);
  }

  async logout(): Promise<void> {
    await this.client.signOut();
    this.user.set(null);
  }

  idToken(): Promise<string | null> {
    return this.client.getIdToken();
  }

  private async syncUser(authUser: AuthUser | null): Promise<void> {
    if (!authUser) {
      this.user.set(null);
      this.ready.set(true);
      return;
    }

    try {
      this.user.set(await firstValueFrom(this.api.getMe()));
    } catch (error) {
      this.error.set(
        (error as HttpErrorResponse).status === 403
          ? 'Usuário não cadastrado'
          : 'Não foi possível carregar seu usuário. Entre novamente.',
      );
      await this.logout();
    } finally {
      this.ready.set(true);
    }
  }
}

function loginErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code ?? '';
  if (INVALID_CREDENTIAL_CODES.includes(code)) {
    return 'E-mail ou senha inválidos';
  }
  if (code === 'auth/too-many-requests') {
    return 'Muitas tentativas. Tente novamente mais tarde.';
  }
  return 'Não foi possível entrar. Tente novamente.';
}

function signupErrorMessage(error: HttpErrorResponse): string {
  const body = error.error as {
    message?: string;
    details?: { message: string }[];
  } | null;
  if (error.status === 400) {
    return body?.details?.[0]?.message ?? body?.message ?? 'Dados inválidos';
  }
  if ((error.status === 403 || error.status === 409) && body?.message) {
    return body.message;
  }
  return 'Não foi possível criar a conta. Tente novamente.';
}
