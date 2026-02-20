/**
 * localStorage persistence helpers for the editor store.
 * Isolated here so slice files stay under 200 lines.
 */
import type { SVGDocument, HistoryEntry } from '../../types/svg';

export function saveToLocalStorage(
  doc: SVGDocument | null,
  history: HistoryEntry[],
  historyIndex: number,
): void {
  try {
    if (doc) {
      localStorage.setItem('svgDocument', JSON.stringify(doc));
      localStorage.setItem('editHistory', JSON.stringify(history));
      localStorage.setItem('historyIndex', historyIndex.toString());
    } else {
      localStorage.removeItem('svgDocument');
      localStorage.removeItem('editHistory');
      localStorage.removeItem('historyIndex');
    }
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

export function loadFromLocalStorage(): {
  doc: SVGDocument | null;
  history: HistoryEntry[];
  historyIndex: number;
} {
  try {
    const docString     = localStorage.getItem('svgDocument');
    const historyString = localStorage.getItem('editHistory');
    const indexString   = localStorage.getItem('historyIndex');

    if (docString && historyString && indexString) {
      return {
        doc:          JSON.parse(docString),
        history:      JSON.parse(historyString),
        historyIndex: parseInt(indexString, 10),
      };
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
  }
  return { doc: null, history: [], historyIndex: -1 };
}

/** Loaded once at module initialisation so the store can read it synchronously. */
export const initialPersistedState = loadFromLocalStorage();
