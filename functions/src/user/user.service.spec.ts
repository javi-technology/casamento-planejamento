const createAuthUser = jest.fn();
const deleteAuthUser = jest.fn();
const setDoc = jest.fn();
const getDoc = jest.fn();
const getCollection = jest.fn();
const doc = jest.fn(() => ({ set: setDoc, get: getDoc }));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    createUser: createAuthUser,
    deleteUser: deleteAuthUser,
  })),
}));
jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: jest.fn(() => 'server-timestamp') },
}));
jest.mock('../firestore', () => ({
  db: jest.fn(() => ({
    collection: jest.fn(() => ({ doc, get: getCollection })),
  })),
}));

import { createUser, getUser, listUsers } from './user.service';

describe('user.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createAuthUser.mockResolvedValue({ uid: 'uid-maria' });
    setDoc.mockResolvedValue(undefined);
  });

  it('cria a conta no Auth e grava o usuário no Firestore', async () => {
    const user = await createUser({
      name: 'Maria',
      email: 'maria@example.com',
      password: 'segredo123',
    });

    expect(createAuthUser).toHaveBeenCalledWith({
      email: 'maria@example.com',
      password: 'segredo123',
      displayName: 'Maria',
    });
    expect(doc).toHaveBeenCalledWith('uid-maria');
    expect(setDoc).toHaveBeenCalledWith({
      name: 'Maria',
      email: 'maria@example.com',
      createdAt: 'server-timestamp',
    });
    expect(user).toEqual({
      id: 'uid-maria',
      name: 'Maria',
      email: 'maria@example.com',
    });
  });

  it('remove a conta do Auth quando a gravação no Firestore falha', async () => {
    setDoc.mockRejectedValue(new Error('firestore indisponível'));

    await expect(
      createUser({
        name: 'Maria',
        email: 'maria@example.com',
        password: 'segredo123',
      }),
    ).rejects.toThrow('firestore indisponível');
    expect(deleteAuthUser).toHaveBeenCalledWith('uid-maria');
  });

  it('busca um usuário pelo id', async () => {
    getDoc.mockResolvedValue({
      exists: true,
      id: 'uid-maria',
      data: () => ({ name: 'Maria', email: 'maria@example.com' }),
    });

    expect(await getUser('uid-maria')).toEqual({
      id: 'uid-maria',
      name: 'Maria',
      email: 'maria@example.com',
    });
  });

  it('devolve null para usuário sem registro', async () => {
    getDoc.mockResolvedValue({ exists: false, id: 'uid-x', data: () => {} });

    expect(await getUser('uid-x')).toBeNull();
  });

  it('lista os usuários ordenados por nome', async () => {
    getCollection.mockResolvedValue({
      docs: [
        { id: 'b', data: () => ({ name: 'Érica', email: 'e@example.com' }) },
        { id: 'a', data: () => ({ name: 'João', email: 'j@example.com' }) },
        { id: 'c', data: () => ({ name: 'ana', email: 'a@example.com' }) },
      ],
    });

    expect((await listUsers()).map((user) => user.name)).toEqual([
      'ana',
      'Érica',
      'João',
    ]);
  });
});
