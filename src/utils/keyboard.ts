/**
 * Check if keyboard shortcuts should be ignored based on the current focus
 * @param e - The keyboard event
 * @param allowEscape - Whether to allow ESC key even when in input fields (default: false)
 * @returns true if shortcuts should be ignored, false otherwise
 */
export function shouldIgnoreKeyboardShortcut(e: KeyboardEvent, allowEscape: boolean = false): boolean {
  const target = e.target as HTMLElement;
  const isInInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  
  // Always allow ESC if specified (for closing modals)
  if (allowEscape && e.key === 'Escape') {
    return false;
  }
  
  return isInInputField;
}
