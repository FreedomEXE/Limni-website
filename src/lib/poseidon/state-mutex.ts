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

import { AsyncLocalStorage } from "node:async_hooks";

let locked = false;
let ownerToken: number | null = null;
let ownerDepth = 0;
let nextToken = 1;
const queue: Array<() => void> = [];
const lockContext = new AsyncLocalStorage<{ token: number }>();

export async function withStateLock<T>(fn: () => Promise<T>): Promise<T> {
  const activeContext = lockContext.getStore();
  if (locked && activeContext && activeContext.token === ownerToken) {
    ownerDepth += 1;
    try {
      return await fn();
    } finally {
      ownerDepth -= 1;
    }
  }

  if (locked) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }

  locked = true;
  ownerToken = nextToken++;
  ownerDepth = 1;
  try {
    return await lockContext.run({ token: ownerToken }, fn);
  } finally {
    ownerDepth -= 1;
    if (ownerDepth === 0) {
      locked = false;
      ownerToken = null;
      const next = queue.shift();
      if (next) next();
    }
  }
}
