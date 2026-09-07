import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { FIREBASE_AUTH } from './app/core/auth.service';
import { environment } from './environments/environment';

registerLocaleData(localePt);

async function loadFirebaseConfig(): Promise<Record<string, string>> {
  if (environment.firebase) {
    return environment.firebase;
  }

  const response = await fetch('/__/firebase/init.json');
  return (await response.json()) as Record<string, string>;
}

async function bootstrap(): Promise<void> {
  const firebaseApp = initializeApp(await loadFirebaseConfig());
  const auth = getAuth(firebaseApp);
  if (environment.useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
  }

  await bootstrapApplication(AppComponent, {
    ...appConfig,
    providers: [
      ...(appConfig.providers ?? []),
      { provide: FIREBASE_AUTH, useValue: auth },
    ],
  });
}

void bootstrap().catch((error: unknown) => console.error(error));
