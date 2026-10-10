import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

// O cadastro é público e responde 403 para convite inválido, sem sessão.
const PUBLIC_URLS = ['/api/signup'];

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/') || PUBLIC_URLS.includes(request.url)) {
    return next(request);
  }

  const auth = inject(AuthService);
  return from(auth.idToken()).pipe(
    switchMap((token) =>
      next(
        token
          ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : request,
      ),
    ),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        void auth.logout();
      }
      return throwError(() => error);
    }),
  );
};
