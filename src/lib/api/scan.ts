'use client';

import { useMutation, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type {
  BatchSyncResponse,
  CycleCountSessionResponse,
  PickListResponse,
  ScanPickResponse,
  ScanPutawayResponse,
  ScanReceiveResponse,
  ScanResolveResponse,
  ScanTransferResponse,
  ScanType,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';
import type { QueuedScan } from '@/lib/scan/queue-core';
import { enqueue, newClientUuid } from '@/lib/scan/queue';

export const scanKeys = {
  pickList: (orderRef: string) => ['scan', 'pick-list', orderRef] as const,
  countSession: (id: string) => ['scan', 'cycle-count', id] as const,
};

/** The live endpoint each scan type posts to when the device is online. */
const ENDPOINT: Record<ScanType, string> = {
  RECEIVE: '/scan/receive',
  PUTAWAY: '/scan/putaway',
  PICK: '/scan/pick',
  TRANSFER: '/scan/transfer',
  CYCLE_COUNT: '', // session-scoped — see submitScan
};

/** A device identifier, stable per install, so a mis-scanning handset is traceable. */
export function deviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const KEY = 'procureflow.scan.device-id';
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = newClientUuid();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

export interface SubmitOutcome<T> {
  /** Present when the scan reached the server. */
  data?: T;
  /** True when the scan was written to the offline queue instead. */
  queued: boolean;
}

/**
 * Submit one scan.
 *
 * The order here is the whole offline story: the scan is written to the local
 * queue **first**, then sent. If the send succeeds the queue row is marked
 * synced; if it fails — or the device is offline — the row stays pending and
 * the sync manager retries it under the same `clientUuid`, which the server
 * treats as idempotent. A scan can therefore never be lost by a dropped
 * response, and can never be applied twice by a retry.
 */
export async function submitScan<T>(
  type: ScanType,
  payload: Record<string, unknown>,
  opts: { sessionId?: string } = {},
): Promise<SubmitOutcome<T>> {
  const clientUuid = newClientUuid();
  const clientTimestamp = new Date().toISOString();

  const body = {
    ...payload,
    deviceId: deviceId(),
    clientUuid,
    clientTimestamp,
  };

  const queued: QueuedScan = {
    clientUuid,
    type,
    payload: body,
    sessionId: opts.sessionId ?? null,
    clientTimestamp,
    status: 'pending',
    attempts: 0,
  };
  await enqueue(queued);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { queued: true };
  }

  const path =
    type === 'CYCLE_COUNT'
      ? `/scan/cycle-count/${opts.sessionId ?? ''}/scan`
      : ENDPOINT[type];

  try {
    const data = await apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
    await enqueue({ ...queued, status: 'synced', syncedAt: new Date().toISOString() });
    return { data, queued: false };
  } catch (err) {
    // A rejection the *server* made (over-pick, unknown barcode) is the
    // operator's problem to fix now, so it is re-thrown for the screen to show.
    // Anything else is treated as a transport failure and left queued.
    if (isServerRejection(err)) {
      await enqueue({
        ...queued,
        status: 'error',
        attempts: 1,
        lastError: err instanceof Error ? err.message : 'Rejected',
      });
      throw err;
    }
    return { queued: true };
  }
}

/** A 4xx that is not 408/429 means the server understood and refused. */
function isServerRejection(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (typeof status !== 'number') return false;
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}

/** Send a chunk of queued scans. Used by the sync manager. */
export async function postBatchSync(scans: QueuedScan[]): Promise<BatchSyncResponse> {
  return apiFetch<BatchSyncResponse>('/scan/batch-sync', {
    method: 'POST',
    body: JSON.stringify({
      scans: scans.map((s) => ({
        type: s.type,
        payload: s.payload,
        clientUuid: s.clientUuid,
        clientTimestamp: s.clientTimestamp,
        sessionId: s.sessionId ?? null,
      })),
    }),
  });
}

// ── queries ──────────────────────────────────────────────────────────────────

/** Barcode → product. Never cached: the same barcode may be scanned repeatedly
 *  and the stock figure on the card must be current each time. */
export function useResolveBarcode() {
  return useMutation({
    mutationFn: (barcodeRaw: string) =>
      apiFetch<ScanResolveResponse>('/scan/resolve', {
        method: 'POST',
        body: JSON.stringify({ barcodeRaw }),
      }),
  });
}

export function usePickList(orderRef: string): UseQueryResult<PickListResponse> {
  return useQuery({
    queryKey: scanKeys.pickList(orderRef),
    queryFn: () =>
      apiFetch<PickListResponse>(`/scan/pick/${encodeURIComponent(orderRef)}`),
    enabled: orderRef.length > 0,
  });
}

export function useCountSession(
  sessionId: string,
): UseQueryResult<CycleCountSessionResponse> {
  return useQuery({
    queryKey: scanKeys.countSession(sessionId),
    queryFn: () => apiFetch<CycleCountSessionResponse>(`/scan/cycle-count/${sessionId}`),
    enabled: sessionId.length > 0,
  });
}

// ── scan submissions ─────────────────────────────────────────────────────────

export function useScanReceive() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      submitScan<ScanReceiveResponse>('RECEIVE', payload),
  });
}

export function useScanPutaway() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      submitScan<ScanPutawayResponse>('PUTAWAY', payload),
  });
}

export function useScanPick() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      submitScan<ScanPickResponse>('PICK', payload),
  });
}

export function useScanTransfer() {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      submitScan<ScanTransferResponse>('TRANSFER', payload),
  });
}

export function useCountScan(sessionId: string) {
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      submitScan<CycleCountSessionResponse>('CYCLE_COUNT', payload, { sessionId }),
  });
}

// ── cycle count session lifecycle (online-only: they are not scans) ──────────

export function useStartCount() {
  return useMutation({
    mutationFn: (body: {
      binBarcodeRaw?: string;
      locationId?: string;
      notes?: string | null;
    }) =>
      apiFetch<CycleCountSessionResponse>('/scan/cycle-count/start', {
        method: 'POST',
        body: JSON.stringify({ ...body, deviceId: deviceId() }),
      }),
  });
}

export function useCompleteCount() {
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<CycleCountSessionResponse>(`/scan/cycle-count/${sessionId}/complete`, {
        method: 'POST',
        body: '{}',
      }),
  });
}

export function useApproveCount() {
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<CycleCountSessionResponse>(`/scan/cycle-count/${sessionId}/approve`, {
        method: 'POST',
        body: '{}',
      }),
  });
}
