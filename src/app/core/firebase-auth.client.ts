import { Injectable, isDevMode } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  Auth,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { AUTH_EMULATOR_URL, firebaseConfig } from './firebase.config';

export interface AuthUser {
  uid: string;
}

// Isola o SDK do Firebase para que o restante do app (e os testes) dependa
// apenas desta interface.
@Injectable({ providedIn: 'root' })
export class FirebaseAuthClient {
  private readonly auth = createAuth();

  onUserChanged(listener: (user: AuthUser | null) => void): void {
    onAuthStateChanged(this.auth, (user) =>
      listener(user ? { uid: user.uid } : null),
    );
  }

  async signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  async getIdToken(): Promise<string | null> {
    return (await this.auth.currentUser?.getIdToken()) ?? null;
  }
}

function createAuth(): Auth {
  const auth = getAuth(initializeApp(firebaseConfig));
  if (isDevMode()) {
    connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
  }
  return auth;
}
