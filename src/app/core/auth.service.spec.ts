import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { User } from '../models';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { AuthUser, FirebaseAuthClient } from './firebase-auth.client';

class FakeAuthClient {
  private listener?: (user: AuthUser | null) => void;
  signedIn: AuthUser | null = null;
  readonly signIn = jasmine.createSpy('signIn').and.callFake(async () => {
    this.emit({ uid: 'uid-maria' });
  });
  readonly signOut = jasmine.createSpy('signOut').and.callFake(async () => {
    this.emit(null);
  });

  onUserChanged(listener: (user: AuthUser | null) => void): void {
    this.listener = listener;
  }

  async getIdToken(): Promise<string | null> {
    return this.signedIn ? `token-${this.signedIn.uid}` : null;
  }

  emit(user: AuthUser | null): void {
    this.signedIn = user;
    this.listener?.(user);
  }
}

const MARIA: User = { id: 'uid-maria', name: 'Maria', email: 'maria@x.com' };

function httpError(status: number, error: unknown = {}): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('AuthService', () => {
  let service: AuthService;
  let client: FakeAuthClient;
  let api: jasmine.SpyObj<ApiService>;

  const settle = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    client = new FakeAuthClient();
    api = jasmine.createSpyObj<ApiService>('ApiService', ['getMe', 'signup']);
    api.getMe.and.returnValue(of(MARIA));
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: FirebaseAuthClient, useValue: client },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  it('fica pronto sem usuário quando não há sessão', () => {
    expect(service.ready()).toBeFalse();

    client.emit(null);

    expect(service.ready()).toBeTrue();
    expect(service.user()).toBeNull();
  });

  it('carrega o usuário cadastrado quando há sessão', async () => {
    client.emit({ uid: 'uid-maria' });
    await settle();

    expect(api.getMe).toHaveBeenCalled();
    expect(service.user()).toEqual(MARIA);
    expect(service.ready()).toBeTrue();
  });

  it('encerra a sessão de usuário sem cadastro na API', async () => {
    api.getMe.and.returnValue(throwError(() => httpError(403)));

    client.emit({ uid: 'uid-orfao' });
    await settle();

    expect(client.signOut).toHaveBeenCalled();
    expect(service.user()).toBeNull();
    expect(service.error()).toBe('Usuário não cadastrado');
    expect(service.canRetry()).toBeFalse();
  });

  it('encerra a sessão quando a API recusa o token (401)', async () => {
    api.getMe.and.returnValue(throwError(() => httpError(401)));

    client.emit({ uid: 'uid-maria' });
    await settle();

    expect(client.signOut).toHaveBeenCalled();
    expect(service.user()).toBeNull();
  });

  it('descarta a resposta de /api/me que chega depois de sair', async () => {
    const pending = new Subject<User>();
    api.getMe.and.returnValue(pending);
    client.emit({ uid: 'uid-maria' });

    await service.logout();
    pending.next(MARIA);
    pending.complete();
    await settle();

    expect(service.user()).toBeNull();
  });

  it('ignora a resposta de uma sessão anterior quando o usuário muda', async () => {
    const first = new Subject<User>();
    const second = new Subject<User>();
    api.getMe.and.returnValues(first, second);
    client.emit({ uid: 'uid-ana' });
    client.emit({ uid: 'uid-maria' });

    second.next(MARIA);
    await settle();
    first.next({ id: 'uid-ana', name: 'Ana', email: 'ana@x.com' });
    await settle();

    expect(service.user()).toEqual(MARIA);
  });

  it('descarta o erro de uma sessão anterior sem encerrar a atual', async () => {
    const first = new Subject<User>();
    api.getMe.and.returnValues(first, of(MARIA));
    client.emit({ uid: 'uid-ana' });
    client.emit({ uid: 'uid-maria' });
    await settle();

    first.error(httpError(403));
    await settle();

    expect(client.signOut).not.toHaveBeenCalled();
    expect(service.user()).toEqual(MARIA);
  });

  it('mantém a sessão do Firebase quando /api/me falha por erro temporário', async () => {
    for (const status of [0, 500, 503]) {
      client.signOut.calls.reset();
      api.getMe.and.returnValue(throwError(() => httpError(status)));

      client.emit({ uid: 'uid-maria' });
      await settle();

      expect(client.signOut).not.toHaveBeenCalled();
      expect(service.user()).toBeNull();
      expect(service.ready()).toBeTrue();
      expect(service.canRetry()).toBeTrue();
      expect(service.error()).toBe(
        'Não foi possível carregar seu usuário. Tente novamente.',
      );
    }
  });

  it('carrega o usuário ao tentar novamente com a sessão mantida', async () => {
    api.getMe.and.returnValues(
      throwError(() => httpError(503)),
      of(MARIA),
    );
    client.emit({ uid: 'uid-maria' });
    await settle();

    await service.retry();

    expect(service.user()).toEqual(MARIA);
    expect(service.error()).toBe('');
    expect(service.canRetry()).toBeFalse();
    expect(client.signOut).not.toHaveBeenCalled();
  });

  it('entra com e-mail normalizado e senha', async () => {
    const ok = await service.login('  Maria@X.com ', 'segredo123');
    await settle();

    expect(ok).toBeTrue();
    expect(client.signIn).toHaveBeenCalledWith('maria@x.com', 'segredo123');
    expect(service.user()).toEqual(MARIA);
  });

  it('informa credencial inválida sem revelar qual campo errou', async () => {
    client.signIn.and.rejectWith({ code: 'auth/invalid-credential' });

    const ok = await service.login('maria@x.com', 'errada');

    expect(ok).toBeFalse();
    expect(service.error()).toBe('E-mail ou senha inválidos');
    expect(service.loading()).toBeFalse();
  });

  it('cadastra pela API e já entra com a nova conta', async () => {
    api.signup.and.returnValue(of(MARIA));

    const ok = await service.signup({
      name: 'Maria',
      email: 'Maria@X.com',
      password: 'segredo123',
      inviteCode: 'convite',
    });
    await settle();

    expect(ok).toBeTrue();
    expect(api.signup).toHaveBeenCalledWith({
      name: 'Maria',
      email: 'maria@x.com',
      password: 'segredo123',
      inviteCode: 'convite',
    });
    expect(client.signIn).toHaveBeenCalledWith('maria@x.com', 'segredo123');
    expect(service.user()).toEqual(MARIA);
  });

  it('mostra a mensagem da API quando o cadastro é recusado', async () => {
    const cases: [HttpErrorResponse, string][] = [
      [
        httpError(403, { message: 'Código de convite inválido' }),
        'Código de convite inválido',
      ],
      [
        httpError(409, { message: 'E-mail já cadastrado' }),
        'E-mail já cadastrado',
      ],
      [
        httpError(400, {
          details: [{ field: 'password', message: 'Senha curta' }],
        }),
        'Senha curta',
      ],
      [httpError(500), 'Não foi possível criar a conta. Tente novamente.'],
    ];

    for (const [error, message] of cases) {
      api.signup.and.returnValue(throwError(() => error));

      const ok = await service.signup({
        name: 'Maria',
        email: 'maria@x.com',
        password: 'segredo123',
        inviteCode: 'convite',
      });

      expect(ok).toBeFalse();
      expect(service.error()).toBe(message);
      expect(client.signIn).not.toHaveBeenCalled();
    }
  });

  it('sai encerrando a sessão do Firebase', async () => {
    client.emit({ uid: 'uid-maria' });
    await settle();

    await service.logout();

    expect(client.signOut).toHaveBeenCalled();
    expect(service.user()).toBeNull();
  });

  it('fornece o ID token da sessão atual', async () => {
    expect(await service.idToken()).toBeNull();

    client.emit({ uid: 'uid-maria' });

    expect(await service.idToken()).toBe('token-uid-maria');
  });
});
