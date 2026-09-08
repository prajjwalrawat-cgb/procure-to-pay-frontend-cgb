import { describe, expect, it } from 'vitest';

import { ApiError } from './api-error';
import { duplicatePosFromError } from './duplicate-po';

/**
 * The client half of the duplicate-order guard. What matters is the telling
 * apart: a duplicate 409 must open a confirm step, and everything else must
 * still reach the buyer as a plain error — reading one as the other either
 * swallows a real failure or asks a question nobody can answer.
 */

/** The exact body the API returns when the guard fires. */
const duplicateProblem = {
  type: 'https://procureflow.io/errors/purchase-order-duplicate',
  title: 'Possible duplicate purchase order',
  status: 409,
  detail: 'The same order was already raised for this vendor as PO-0504.',
  instance: '/purchase-orders',
  context: {
    duplicates: [
      {
        id: 'po_0504',
        number: 'PO-0504',
        status: 'ISSUED',
        totalAmount: '76936.0000',
        createdAt: '2026-09-03T06:09:00.000Z',
      },
    ],
    windowDays: 7,
    confirmable: true,
  },
};

describe('duplicatePosFromError', () => {
  it('returns the matched orders for a duplicate 409', () => {
    const matched = duplicatePosFromError(new ApiError(409, duplicateProblem, 'Failed'));
    expect(matched?.duplicates).toEqual([expect.objectContaining({ number: 'PO-0504' })]);
  });

  it('carries the window the server actually used, so the dialog cannot misquote it', () => {
    const matched = duplicatePosFromError(new ApiError(409, duplicateProblem, 'Failed'));
    expect(matched?.windowDays).toBe(7);
  });

  it('falls back to a window when the server sent none', () => {
    const noWindow = {
      ...duplicateProblem,
      context: { duplicates: duplicateProblem.context.duplicates },
    };
    expect(duplicatePosFromError(new ApiError(409, noWindow, 'Failed'))?.windowDays).toBe(
      7,
    );
  });

  it('ignores a different domain error with the same status', () => {
    const other = {
      type: 'https://procureflow.io/errors/purchase-order-state',
      title: 'Invalid purchase order state',
      status: 409,
      context: { status: 'ISSUED' },
    };
    expect(duplicatePosFromError(new ApiError(409, other, 'Failed'))).toBeNull();
  });

  it('ignores a plain Error, so a network failure still toasts', () => {
    expect(duplicatePosFromError(new Error('Failed to fetch'))).toBeNull();
  });

  it('ignores a duplicate error carrying no orders', () => {
    // Nothing to show in the dialog, so this has to fall through to the toast
    // rather than opening an empty confirm step the buyer cannot act on.
    const empty = { ...duplicateProblem, context: { duplicates: [] } };
    expect(duplicatePosFromError(new ApiError(409, empty, 'Failed'))).toBeNull();
  });
});
