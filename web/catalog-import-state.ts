import type { ExcelPreview, ExcelImportResult } from '../src/catalog-import.ts';

type RefreshState = { status: 'pending' | 'succeeded' } | { status: 'failed'; message: string };
export type CatalogImportState =
  | { status: 'editing' }
  | { status: 'preview'; preview: ExcelPreview }
  | { status: 'completed'; result: ExcelImportResult; refresh: RefreshState };
export type CatalogImportEvent =
  | { kind: 'edit' }
  | { kind: 'preview'; preview: ExcelPreview }
  | { kind: 'confirmed'; result: ExcelImportResult }
  | { kind: 'refresh_started' | 'refresh_succeeded' }
  | { kind: 'refresh_failed'; message: string };

export const initialCatalogImport: CatalogImportState = { status: 'editing' };
export function transitionCatalogImport(state: CatalogImportState, event: CatalogImportEvent): CatalogImportState {
  if (state.status === 'completed') {
    if (event.kind === 'refresh_started') return { ...state, refresh: { status: 'pending' } };
    if (event.kind === 'refresh_succeeded') return { ...state, refresh: { status: 'succeeded' } };
    if (event.kind === 'refresh_failed') return { ...state, refresh: { status: 'failed', message: event.message } };
    return state; // A committed batch cannot return to editing or confirmation.
  }
  if (event.kind === 'edit') return initialCatalogImport;
  if (event.kind === 'preview') return { status: 'preview', preview: event.preview };
  if (event.kind === 'confirmed' && state.status === 'preview' && state.preview.valid && state.preview.previewId) {
    return { status: 'completed', result: event.result, refresh: { status: 'pending' } };
  }
  return state;
}
