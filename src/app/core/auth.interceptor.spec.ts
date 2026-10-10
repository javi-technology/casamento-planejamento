import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;

  const settle = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', [
      'idToken',
      'logout',
    ]);
    auth.idToken.and.resolveTo('token-1');
    auth.logout.and.resolveTo();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('envia o ID token nas rotas da API', async () => {
    const response = firstValueFrom(http.get('/api/budget'));
    await settle();

    const request = backend.expectOne('/api/budget');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    expect(request.request.headers.has('X-User-Email')).toBeFalse();
    request.flush({});
    await response;
  });

  it('não envia token para o cadastro nem fora da API', async () => {
    const signup = firstValueFrom(http.post('/api/signup', {}));
    const asset = firstValueFrom(http.get('/assets/x.json'));
    await settle();

    const requests = [
      backend.expectOne('/api/signup'),
      backend.expectOne('/assets/x.json'),
    ];
    requests.forEach((request) => {
      expect(request.request.headers.has('Authorization')).toBeFalse();
      request.flush({});
    });
    await Promise.all([signup, asset]);
  });

  it('encerra a sessão quando a API recusa o token', async () => {
    for (const status of [401, 403]) {
      const response = firstValueFrom(http.get('/api/budget')).catch(
        () => undefined,
      );
      await settle();
      backend
        .expectOne('/api/budget')
        .flush({}, { status, statusText: 'Erro' });
      await response;
    }

    expect(auth.logout).toHaveBeenCalledTimes(2);
  });

  it('não encerra a sessão quando o cadastro é recusado', async () => {
    const response = firstValueFrom(http.post('/api/signup', {})).catch(
      () => undefined,
    );
    await settle();
    backend
      .expectOne('/api/signup')
      .flush({}, { status: 403, statusText: 'Forbidden' });
    await response;

    expect(auth.logout).not.toHaveBeenCalled();
  });
});
