'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import type { QueuedScan, QueueSummary } from './queue-core';
import { summarise } from './queue-core';

/**
 * The device-side scan queue, backed by IndexedDB.
 *
 * Every scan is written here *before* it is sent. That ordering is the whole
 * design: if the request never leaves the handset, or the response never comes
 * back, the scan is still on the device and the queue will send it again under
 * the same `clientUuid`. The server's idempotency key makes the retry free.
 *
 * IndexedDB rather than localStorage because this survives being killed by iOS
 * mid-shift, holds structured records, and does not block the UI thread while
 * an operator is scanning.
 */

const DB_NAME = 'procureflow-scan';
const DB_VERSION = 1;
const STORE = 'scans';

interface ScanQueueDb extends DBSchema {
  [STORE]: {
    key: string;
    value: QueuedScan;
    indexes: { 'by-status': string; 'by-time': string };
  };
}

let dbPromise: Promise<IDBPDatabase<ScanQueueDb>> | null = null;

function db(): Promise<IDBPDatabase<ScanQueueDb>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable in this context'));
  }
  dbPromise ??= openDB<ScanQueueDb>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore(STORE, { keyPath: 'clientUuid' });
      store.createIndex('by-status', 'status');
      store.createIndex('by-time', 'clientTimestamp');
    },
  });
  return dbPromise;
}

/** The storage contract the sync manager depends on — see ScanSyncManager. */
export interface ScanQueueStore {
  all(): Promise<QueuedScan[]>;
  put(scan: QueuedScan): Promise<void>;
  putMany(scans: QueuedScan[]): Promise<void>;
  remove(clientUuid: string): Promise<void>;
  clearSynced(): Promise<number>;
}

export const scanQueue: ScanQueueStore = {
  async all() {
    return (await db()).getAll(STORE);
  },

  async put(scan) {
    await (await db()).put(STORE, scan);
  },

  async putMany(scans) {
    const tx = (await db()).transaction(STORE, 'readwrite');
    await Promise.all(scans.map((s) => tx.store.put(s)));
    await tx.done;
  },

  async remove(clientUuid) {
    await (await db()).delete(STORE, clientUuid);
  },

  /**
   * Drop scans the server has confirmed. Kept as an explicit call rather than
   * deleting on success: the operator's "last synced" line and the day's
   * history both read from these rows, and a queue that empties itself the
   * instant a scan lands gives no evidence anything happened.
   */
  async clearSynced() {
    const database = await db();
    const tx = database.transaction(STORE, 'readwrite');
    const rows = await tx.store.getAll();
    const synced = rows.filter((r) => r.status === 'synced');
    await Promise.all(synced.map((r) => tx.store.delete(r.clientUuid)));
    await tx.done;
    return synced.length;
  },
};

/** Queue a scan for sending. */
export async function enqueue(scan: QueuedScan): Promise<void> {
  await scanQueue.put(scan);
}

/** Current counts for the sync indicator. */
export async function queueSummary(): Promise<QueueSummary> {
  return summarise(await scanQueue.all());
}

/**
 * A UUID for the idempotency key. `crypto.randomUUID` is present in every
 * browser that can run a service worker; the fallback exists only so a
 * non-secure-context dev server does not break the whole flow.
 */
export function newClientUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
