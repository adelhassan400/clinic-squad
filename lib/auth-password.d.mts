export interface PasswordVerification {
  valid: boolean;
  needsUpgrade: boolean;
  legacy: boolean;
}

export function hashPassword(password: string): Promise<string>;
export function verifyPassword(
  password: string,
  storedHash: string,
): Promise<PasswordVerification>;
export function upgradeLegacyPassword(
  password: string,
  storedHash: string,
  persistHash: (encodedHash: string) => Promise<unknown>,
): Promise<boolean>;
