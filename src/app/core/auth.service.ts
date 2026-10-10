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
  readonly canRetry = signal(false);
  // Identifica a sincronização mais recente. Respostas de sessões anteriores
  // (ex.: /api/me que chega depois de "Sair") são descartadas.
  private syncId = 0;
  private authUser: AuthUser | null = null;

  constructor() {
    this.client.onUserChanged((authUser) => {
      this.authUser = authUser;
      void this.syncUser(authUser);
    });
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
    this.syncId++;
    this.canRetry.set(false);
    await this.client.signOut();
    this.user.set(null);
  }

  async retry(): Promise<void> {
    await this.syncUser(this.authUser);
  }

  idToken(): Promise<string | null> {
    return this.client.getIdToken();
  }

  private async syncUser(authUser: AuthUser | null): Promise<void> {
    const syncId = ++this.syncId;
    this.canRetry.set(false);
    if (!authUser) {
      this.user.set(null);
      this.ready.set(true);
      return;
    }

    try {
      this.error.set('');
      const user = await firstValueFrom(this.api.getMe());
      if (syncId === this.syncId) {
        this.user.set(user);
      }
    } catch (error) {
      if (syncId !== this.syncId) {
        return;
      }
      const status = (error as HttpErrorResponse).status;
      if (status === 401 || status === 403) {
        this.error.set(
          status === 403
            ? 'Usuário não cadastrado'
            : 'Sessão inválida ou expirada',
        );
        await this.logout();
      } else {
        // Falha de rede ou da API não invalida a sessão: o usuário só precisa
        // tentar de novo, sem digitar a senha outra vez.
        this.error.set(
          'Não foi possível carregar seu usuário. Tente novamente.',
        );
        this.canRetry.set(true);
      }
    } finally {
      if (syncId === this.syncId) {
        this.ready.set(true);
      }
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
