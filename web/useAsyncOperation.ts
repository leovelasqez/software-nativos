import { useState, useSyncExternalStore } from 'react';
import { createAsyncOperation } from '../src/async-operation.ts';

export function useAsyncOperation(fallbackMessage?: string) {
  const [operation] = useState(() => createAsyncOperation(fallbackMessage));
  const state = useSyncExternalStore(operation.subscribe, operation.getSnapshot);
  return { state, busy: state.status === 'running', error: state.status === 'failed' ? state.message : '', run: operation.run, reset: operation.reset };
}
