import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';

export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);
  readonly unauthorized = signal(false);

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.user.set(user);
      this.ready.set(true);
      if (user) {
        this.unauthorized.set(false);
      }
    });
  }

  async signInWithGoogle(): Promise<void> {
    this.unauthorized.set(false);
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
  }

  async getIdToken(): Promise<string | null> {
    return this.auth.currentUser?.getIdToken() ?? null;
  }

  markUnauthorized(): void {
    this.unauthorized.set(true);
  }
}
