export type EditorLoadGuardRef = {
  current: number;
};

export function createEditorLoadGuard(ref: EditorLoadGuardRef, signal?: AbortSignal) {
  const sequence = ref.current + 1;
  ref.current = sequence;

  return {
    sequence,
    isCurrent() {
      return !signal?.aborted && ref.current === sequence;
    },
  };
}
