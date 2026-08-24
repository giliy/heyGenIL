'use client';
// Editor keyboard shortcuts:
//   Ctrl/Cmd+Z        undo
//   Ctrl/Cmd+Shift+Z  redo   (also Ctrl+Y)
//   Delete/Backspace  remove the selected overlay
// Ignored while typing in an input/textarea/contenteditable.
import { useEffect } from 'react';
import { useEditorStore, undo, redo } from '../_store/editorStore';

function isEditableTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function useEditorHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((mod && key === 'z' && e.shiftKey) || (mod && key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        const s = useEditorStore.getState();
        if (s.selectedSceneId && s.selectedOverlayId) {
          e.preventDefault();
          s.removeOverlay(s.selectedSceneId, s.selectedOverlayId);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
