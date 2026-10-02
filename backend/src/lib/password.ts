import { argon2id, argon2Verify } from "hash-wasm";
import { randomBytes } from "node:crypto";

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 4096,
    hashLength: 32,
    outputType: "encoded",
  });
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2Verify({ password, hash });
  } catch {
    return false;
  }
}
