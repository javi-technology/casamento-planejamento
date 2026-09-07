import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }

  const auth = inject(AuthService);
  return from(auth.getIdToken()).pipe(
    switchMap((token) => {
      const authenticated = token
        ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : request;
      return next(authenticated);
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 403) {
        auth.markUnauthorized();
      }
      return throwError(() => error);
    }),
  );
};
