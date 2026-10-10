import { NewUser, User } from './user.types';

export async function createUser(_input: NewUser): Promise<User> {
  throw new Error('não implementado');
}

export async function getUser(_id: string): Promise<User | null> {
  throw new Error('não implementado');
}

export async function listUsers(): Promise<User[]> {
  throw new Error('não implementado');
}
