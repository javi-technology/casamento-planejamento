import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firestore';
import { NewUser, User } from './user.types';

function usersCollection() {
  return db().collection('users');
}

function toUser(id: string, data: FirebaseFirestore.DocumentData): User {
  return { id, name: String(data.name), email: String(data.email) };
}

export async function createUser({
  name,
  email,
  password,
}: NewUser): Promise<User> {
  const { uid } = await getAuth().createUser({
    email,
    password,
    displayName: name,
  });
  try {
    await usersCollection()
      .doc(uid)
      .set({ name, email, createdAt: FieldValue.serverTimestamp() });
  } catch (error) {
    // Sem o registro em `users`, a conta ficaria bloqueada e o e-mail ocupado.
    await getAuth().deleteUser(uid);
    throw error;
  }
  return { id: uid, name, email };
}

export async function getUser(id: string): Promise<User | null> {
  const snapshot = await usersCollection().doc(id).get();
  return snapshot.exists ? toUser(snapshot.id, snapshot.data() ?? {}) : null;
}

export async function listUsers(): Promise<User[]> {
  const snapshot = await usersCollection().get();
  return snapshot.docs
    .map((doc) => toUser(doc.id, doc.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
