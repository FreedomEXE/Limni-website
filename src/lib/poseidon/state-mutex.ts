/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: state-mutex.ts
 *
 * Description:
 * Shared async mutex for state/archive writes. Prevents concurrent updates
 * from Proteus chat flows and Poseidon curation.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

let locked = false;
const queue: Array<() => void> = [];

export async function withStateLock<T>(fn: () => Promise<T>): Promise<T> {
  if (locked) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }

  locked = true;
  try {
    return await fn();
  } finally {
    locked = false;
    const next = queue.shift();
    if (next) next();
  }
}
