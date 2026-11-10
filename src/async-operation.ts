export type AsyncOperationState =
  | { readonly status: 'idle' | 'running' | 'succeeded' }
  | { readonly status: 'failed'; readonly message: string };

/** In-memory UI operation. Durable commands still need their own idempotency key.
 * Duplicate runs resolve without invoking task; keep completion effects inside task.
 */
export function createAsyncOperation(fallbackMessage = 'No se pudo completar la operación.') {
  let state: AsyncOperationState = { status: 'idle' };
  const listeners = new Set<() => void>();
  function publish(next: AsyncOperationState) {
    state = next;
    for (const listener of listeners) listener();
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reset() { if (state.status !== 'running') publish({ status: 'idle' }); },
    run(task: () => Promise<void>): Promise<void> {
      if (state.status === 'running') return Promise.resolve();
      // Acquire before invoking task or yielding: two submit events may share a render.
      publish({ status: 'running' });
      return Promise.resolve().then(task).then(
        () => { publish({ status: 'succeeded' }); },
        error => { publish({ status: 'failed', message: error instanceof Error && error.message ? error.message : fallbackMessage }); },
      );
    },
  };
}
