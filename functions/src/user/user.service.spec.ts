const createAuthUser = jest.fn();
const deleteAuthUser = jest.fn();
const updateAuthUser = jest.fn();
const getAuthUserByEmail = jest.fn();
const setDoc = jest.fn();
const getDoc = jest.fn();
const deleteDoc = jest.fn();
const getCollection = jest.fn();
const doc = jest.fn(() => ({ set: setDoc, get: getDoc, delete: deleteDoc }));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    createUser: createAuthUser,
    deleteUser: deleteAuthUser,
    updateUser: updateAuthUser,
    getUserByEmail: getAuthUserByEmail,
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

const NEW_USER = {
  name: 'Maria',
  email: 'maria@example.com',
  password: 'segredo123',
};

const EMAIL_EXISTS = { code: 'auth/email-already-exists' };

function authRecord(overrides: {
  disabled?: boolean;
  lastSignInTime?: string;
  creationTime?: string;
}) {
  return {
    uid: 'uid-orfao',
    disabled: overrides.disabled ?? true,
    metadata: {
      creationTime:
        overrides.creationTime ??
        new Date(Date.now() - 10 * 60_000).toUTCString(),
      lastSignInTime: overrides.lastSignInTime,
    },
  };
}

describe('user.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createAuthUser.mockResolvedValue({ uid: 'uid-maria' });
    updateAuthUser.mockResolvedValue(undefined);
    deleteAuthUser.mockResolvedValue(undefined);
    setDoc.mockResolvedValue(undefined);
    deleteDoc.mockResolvedValue(undefined);
  });

  it('cria a conta desabilitada, grava o usuário e só então a habilita', async () => {
    const calls: string[] = [];
    createAuthUser.mockImplementation(async () => {
      calls.push('createUser');
      return { uid: 'uid-maria' };
    });
    setDoc.mockImplementation(async () => {
      calls.push('setDoc');
    });
    updateAuthUser.mockImplementation(async () => {
      calls.push('enable');
    });

    const user = await createUser(NEW_USER);

    expect(createAuthUser).toHaveBeenCalledWith({
      email: 'maria@example.com',
      password: 'segredo123',
      displayName: 'Maria',
      disabled: true,
    });
    expect(doc).toHaveBeenCalledWith('uid-maria');
    expect(setDoc).toHaveBeenCalledWith({
      name: 'Maria',
      email: 'maria@example.com',
      createdAt: 'server-timestamp',
    });
    expect(updateAuthUser).toHaveBeenCalledWith('uid-maria', {
      disabled: false,
    });
    expect(calls).toEqual(['createUser', 'setDoc', 'enable']);
    expect(user).toEqual({
      id: 'uid-maria',
      name: 'Maria',
      email: 'maria@example.com',
    });
  });

  describe('falha depois de criar a conta', () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
      consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => consoleError.mockRestore());

    it('remove a conta e o registro quando a gravação no Firestore falha', async () => {
      setDoc.mockRejectedValue(new Error('firestore indisponível'));

      await expect(createUser(NEW_USER)).rejects.toThrow(
        'firestore indisponível',
      );

      expect(deleteAuthUser).toHaveBeenCalledWith('uid-maria');
      expect(deleteDoc).toHaveBeenCalled();
      expect(updateAuthUser).not.toHaveBeenCalled();
    });

    it('remove a conta e o registro quando a habilitação falha', async () => {
      updateAuthUser.mockRejectedValue(new Error('auth indisponível'));

      await expect(createUser(NEW_USER)).rejects.toThrow('auth indisponível');

      expect(deleteAuthUser).toHaveBeenCalledWith('uid-maria');
      expect(deleteDoc).toHaveBeenCalled();
    });

    it('registra a falha da compensação e mantém o erro original', async () => {
      setDoc.mockRejectedValue(new Error('firestore indisponível'));
      deleteAuthUser.mockRejectedValue(new Error('auth indisponível'));

      await expect(createUser(NEW_USER)).rejects.toThrow(
        'firestore indisponível',
      );

      expect(consoleError).toHaveBeenCalledWith(
        '[signup] não foi possível remover a conta incompleta',
        expect.objectContaining({
          uid: 'uid-maria',
          email: 'maria@example.com',
        }),
      );
      expect(deleteDoc).toHaveBeenCalled();
    });
  });

  describe('e-mail já existente', () => {
    beforeEach(() => {
      createAuthUser.mockRejectedValueOnce(EMAIL_EXISTS);
    });

    it('descarta a conta incompleta de um cadastro anterior e repete uma vez', async () => {
      getAuthUserByEmail.mockResolvedValue(authRecord({}));

      const user = await createUser(NEW_USER);

      expect(deleteDoc).toHaveBeenCalled();
      expect(deleteAuthUser).toHaveBeenCalledWith('uid-orfao');
      expect(createAuthUser).toHaveBeenCalledTimes(2);
      expect(user.id).toBe('uid-maria');
    });

    it.each([
      ['conta habilitada', authRecord({ disabled: false })],
      [
        'conta que já fez login',
        authRecord({ lastSignInTime: new Date().toUTCString() }),
      ],
      [
        'cadastro em andamento (criada há instantes)',
        authRecord({ creationTime: new Date().toUTCString() }),
      ],
    ])('mantém o erro e não apaga nada: %s', async (_label, record) => {
      getAuthUserByEmail.mockResolvedValue(record);

      await expect(createUser(NEW_USER)).rejects.toEqual(EMAIL_EXISTS);

      expect(deleteAuthUser).not.toHaveBeenCalled();
      expect(deleteDoc).not.toHaveBeenCalled();
      expect(createAuthUser).toHaveBeenCalledTimes(1);
    });

    it('mantém o erro quando a conta não é encontrada', async () => {
      getAuthUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });

      await expect(createUser(NEW_USER)).rejects.toEqual(EMAIL_EXISTS);
    });

    it('não repete mais de uma vez', async () => {
      getAuthUserByEmail.mockResolvedValue(authRecord({}));
      createAuthUser.mockRejectedValueOnce(EMAIL_EXISTS);

      await expect(createUser(NEW_USER)).rejects.toEqual(EMAIL_EXISTS);

      expect(createAuthUser).toHaveBeenCalledTimes(2);
    });
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
