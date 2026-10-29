/** Take-local words must never survive a discarded or failed recording. */
export interface TakeReview {
  blob: Blob | undefined;
  words: string;
  error: string | undefined;
}
export type TakeAction =
  | { type: 'start' | 'discard' | 'saved' }
  | { type: 'words'; value: string }
  | { type: 'captured'; blob: Blob }
  | { type: 'failed'; message: string };
export const EMPTY_TAKE: TakeReview = { blob: undefined, words: '', error: undefined };
export function takeReducer(state: TakeReview, action: TakeAction): TakeReview {
  switch (action.type) {
    case 'start':
    case 'discard':
    case 'saved':
      return { ...EMPTY_TAKE };
    case 'words':
      return { ...state, words: action.value };
    case 'captured':
      return state.error === undefined ? { ...state, blob: action.blob } : state;
    case 'failed':
      return { ...EMPTY_TAKE, error: action.message };
  }
}

export interface ReviewedDraft<T> {
  fields: T;
  empty: T;
  sourceId: string;
  applied: boolean;
}
export type DraftAction<T> =
  | { type: 'edit'; patch: Partial<T> }
  | { type: 'source'; id: string }
  | { type: 'apply'; fields: T }
  | { type: 'clear' };
export function reviewedDraftReducer<T extends object>(
  state: ReviewedDraft<T>,
  action: DraftAction<T>,
): ReviewedDraft<T> {
  switch (action.type) {
    case 'edit':
      return { ...state, fields: { ...state.fields, ...action.patch } };
    case 'source':
      return {
        ...state,
        sourceId: action.id,
        fields: state.applied && action.id !== state.sourceId ? { ...state.empty } : state.fields,
        applied: action.id === state.sourceId ? state.applied : false,
      };
    case 'apply':
      return { ...state, fields: action.fields, applied: true };
    case 'clear':
      return { ...state, fields: { ...state.empty }, applied: false };
  }
}
export function draftState<T extends object>(fields: T, sourceId: string): ReviewedDraft<T> {
  return { fields, empty: { ...fields }, sourceId, applied: false };
}
