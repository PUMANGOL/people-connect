import { compare, hash } from 'bcryptjs';

/** Mesmo algoritmo das hashes históricas (pgcrypto `bf` / bcrypt). */
export function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(data: { password: string; hash: string }): Promise<boolean> {
  const { password, hash: passwordHash } = data;
  try {
    return await compare(password, passwordHash);
  } catch {
    return false;
  }
}
