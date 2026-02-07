import { useRef, useImperativeHandle, forwardRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onCursorChange?: (line: number, column: number) => void;
  onSelectionChange?: (startLine: number, endLine: number) => void;
  height?: string;
}

export interface CodeEditorRef {
  scrollToLine: (line: number) => void;
  highlightRange: (startLine: number, endLine: number, className?: string) => void;
  highlightCharacterRange: (line: number, startColumn: number, endColumn: number, className?: string) => void;
  clearHighlights: () => void;
}

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(({
  value,
  onChange,
  onCursorChange,
  onSelectionChange,
  height = '100%',
}, ref) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleEditorDidMount: OnMount = (editor, _monaco) => {
    editorRef.current = editor;

    // Listen for cursor position changes
    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange(e.position.lineNumber, e.position.column);
      }
    });

    // Listen for selection changes
    editor.onDidChangeCursorSelection((e) => {
      if (onSelectionChange) {
        onSelectionChange(
          e.selection.startLineNumber,
          e.selection.endLineNumber
        );
      }
    });

    // Listen for content changes
    editor.onDidChangeModelContent(() => {
      if (onChange) {
        onChange(editor.getValue());
      }
    });

    // Configure editor features
    editor.updateOptions({
      minimap: { enabled: true },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      fontSize: 13,
      tabSize: 2,
      formatOnPaste: true,
      formatOnType: true,
    });
  };

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    scrollToLine: (line: number) => {
      if (editorRef.current) {
        editorRef.current.revealLineInCenter(line);
      }
    },
    
    highlightRange: (startLine: number, endLine: number, className = 'highlighted-path') => {
      if (!editorRef.current) return;
      
      const range = new monaco.Range(startLine, 1, endLine, 999);
      
      const newDecorations = editorRef.current.deltaDecorations(
        decorationsRef.current,
        [
          {
            range,
            options: {
              isWholeLine: true,
              className: className,
              glyphMarginClassName: 'highlighted-glyph',
            },
          },
        ]
      );
      
      decorationsRef.current = newDecorations;
    },
    
    highlightCharacterRange: (line: number, startColumn: number, endColumn: number, className = 'highlighted-path') => {
      if (!editorRef.current) return;
      
      const range = new monaco.Range(line, startColumn, line, endColumn);
      
      const newDecorations = editorRef.current.deltaDecorations(
        decorationsRef.current,
        [
          {
            range,
            options: {
              inlineClassName: className,
              className: className,
            },
          },
        ]
      );
      
      decorationsRef.current = newDecorations;
    },
    
    clearHighlights: () => {
      if (editorRef.current) {
        decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
      }
    },
  }));

  return (
    <div className="w-full h-full">
      <Editor
        height={height}
        defaultLanguage="xml"
        value={value}
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          readOnly: false,
          minimap: { enabled: true },
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
          },
        }}
      />
    </div>
  );
});

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
