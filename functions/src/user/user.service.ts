import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firestore';
import { NewUser, User } from './user.types';

// Cadastro incompleto só é descartado depois dessa janela, para não apagar um
// cadastro em andamento (criação da conta e gravação levam milissegundos).
const UNFINISHED_SIGNUP_GRACE_MS = 60_000;

function usersCollection() {
  return db().collection('users');
}

function toUser(id: string, data: FirebaseFirestore.DocumentData): User {
  return { id, name: String(data.name), email: String(data.email) };
}

function errorCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

export async function createUser(input: NewUser): Promise<User> {
  try {
    return await register(input);
  } catch (error) {
    if (
      errorCode(error) !== 'auth/email-already-exists' ||
      !(await discardUnfinishedSignup(input.email))
    ) {
      throw error;
    }
    return register(input);
  }
}

// A conta nasce desabilitada e só é habilitada depois de gravar `users/{uid}`.
// Assim, uma falha entre os dois passos deixa um rastro reconhecível (conta
// desabilitada que nunca entrou), que o próximo cadastro do mesmo e-mail
// descarta, em vez de bloquear o e-mail para sempre.
async function register({ name, email, password }: NewUser): Promise<User> {
  const { uid } = await getAuth().createUser({
    email,
    password,
    displayName: name,
    disabled: true,
  });
  try {
    await usersCollection()
      .doc(uid)
      .set({ name, email, createdAt: FieldValue.serverTimestamp() });
    await getAuth().updateUser(uid, { disabled: false });
  } catch (error) {
    await removeIncompleteAccount(uid, email);
    throw error;
  }
  return { id: uid, name, email };
}

async function removeIncompleteAccount(
  uid: string,
  email: string,
): Promise<void> {
  const failures: string[] = [];
  try {
    await usersCollection().doc(uid).delete();
  } catch (error) {
    failures.push(`users: ${(error as Error).message}`);
  }
  try {
    await getAuth().deleteUser(uid);
  } catch (error) {
    failures.push(`auth: ${(error as Error).message}`);
  }
  if (failures.length) {
    console.error('[signup] não foi possível remover a conta incompleta', {
      uid,
      email,
      failures,
    });
  }
}

async function discardUnfinishedSignup(email: string): Promise<boolean> {
  let existing;
  try {
    existing = await getAuth().getUserByEmail(email);
  } catch {
    return false;
  }

  const createdAt = Date.parse(existing.metadata.creationTime);
  const unfinished =
    existing.disabled &&
    !existing.metadata.lastSignInTime &&
    Date.now() - createdAt > UNFINISHED_SIGNUP_GRACE_MS;
  if (!unfinished) {
    return false;
  }

  await removeIncompleteAccount(existing.uid, email);
  return true;
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
