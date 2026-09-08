import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) {
    return next(request);
  }

  const auth = inject(AuthService);
  const email = auth.email();
  const authenticated = email
    ? request.clone({ setHeaders: { 'X-User-Email': email } })
    : request;

  return next(authenticated).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 403 && auth.email() === email) {
        auth.markUnauthorized();
      }
      return throwError(() => error);
    }),
  );
};
