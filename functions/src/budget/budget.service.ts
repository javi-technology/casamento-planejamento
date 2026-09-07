import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';
import { DEFAULT_BUDGET } from './defaults';
import { Category, Expense, WeddingBudget } from './types';

const DATABASE_ID = 'casamentoplanejamentojavidb';

function db() {
  return getFirestore(getApp(), DATABASE_ID);
}

function budgetRef() {
  return db().collection('budgets').doc('default');
}

function expenseRef(id: string) {
  return budgetRef().collection('expenses').doc(id);
}

function stripExpenseData(
  id: string,
  data: FirebaseFirestore.DocumentData,
): Expense {
  return { id, ...data } as Expense;
}

export async function getBudget(): Promise<WeddingBudget> {
  const snapshot = await budgetRef().get();
  const base = DEFAULT_BUDGET();
  const data = snapshot.exists ? snapshot.data() : undefined;
  const expensesSnapshot = await budgetRef().collection('expenses').get();

  return {
    guests: Number(data?.guests ?? base.guests),
    maxBudget: Number(data?.maxBudget ?? base.maxBudget),
    categories: (data?.categories as Category[] | undefined) ?? base.categories,
    expenses: expensesSnapshot.docs.map((doc) =>
      stripExpenseData(doc.id, doc.data()),
    ),
  };
}

export async function updateBudget(
  changes: Pick<WeddingBudget, 'guests' | 'maxBudget' | 'categories'>,
): Promise<WeddingBudget> {
  await budgetRef().set(
    {
      ...changes,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return getBudget();
}

export async function importBudget(
  budget: WeddingBudget,
): Promise<WeddingBudget> {
  const expensesCollection = budgetRef().collection('expenses');
  const current = await expensesCollection.get();
  const batch = db().batch();

  current.docs.forEach((doc) => batch.delete(doc.ref));
  batch.set(
    budgetRef(),
    {
      guests: budget.guests,
      maxBudget: budget.maxBudget,
      categories: budget.categories,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  budget.expenses.forEach(({ id, ...expense }) => {
    batch.set(expensesCollection.doc(id), {
      ...expense,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: expense.createdAt ?? FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
  return getBudget();
}

export async function createExpense(
  expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Expense> {
  const reference = expensesCollection().doc();
  const data = {
    ...expense,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await reference.set(data);
  const saved = await reference.get();
  return stripExpenseData(reference.id, saved.data() ?? data);
}

export async function updateExpense(
  id: string,
  changes: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Expense | null> {
  const reference = expenseRef(id);
  const existing = await reference.get();
  if (!existing.exists) {
    return null;
  }

  await reference.set(
    { ...changes, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  const saved = await reference.get();
  return stripExpenseData(id, saved.data() ?? {});
}

export async function getExpense(id: string): Promise<Expense | null> {
  const snapshot = await expenseRef(id).get();
  return snapshot.exists ? stripExpenseData(id, snapshot.data() ?? {}) : null;
}

export async function deleteExpense(id: string): Promise<Expense | null> {
  const existing = await getExpense(id);
  if (!existing) {
    return null;
  }

  await expenseRef(id).delete();
  return existing;
}

function expensesCollection() {
  return budgetRef().collection('expenses');
}
