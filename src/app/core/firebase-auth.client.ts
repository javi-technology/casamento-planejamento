import { Injectable } from '@angular/core';

export interface AuthUser {
  uid: string;
}

@Injectable({ providedIn: 'root' })
export class FirebaseAuthClient {
  onUserChanged(_listener: (user: AuthUser | null) => void): void {}

  async signIn(_email: string, _password: string): Promise<void> {}

  async signOut(): Promise<void> {}

  async getIdToken(): Promise<string | null> {
    return null;
  }
}
