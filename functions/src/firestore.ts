import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DATABASE_ID = 'casamentoplanejamentojavidb';

export function db() {
  return getFirestore(getApp(), DATABASE_ID);
}
