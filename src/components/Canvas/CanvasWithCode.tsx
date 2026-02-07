import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas } from './Canvas';
import { CodeEditor, type CodeEditorRef } from '../CodeEditor/CodeEditor';
import { useEditorStore } from '../../store/editorStore';
import { generateSVGCodeWithMappings, findPathAtLine } from '../../engine/codeMapping';
import { parseSVG } from '../../engine/parser';

/**
 * Wrapper component that combines Canvas with resizable Code Editor
 */
export const CanvasWithCode: React.FC = () => {
  const showCodePanel = useEditorStore(state => state.showCodePanel);
  const codePanelHeight = useEditorStore(state => state.codePanelHeight);
  const setCodePanelHeight = useEditorStore(state => state.setCodePanelHeight);
  const svgDocument = useEditorStore(state => state.svgDocument);
  const selectedPathIds = useEditorStore(state => state.selectedPathIds);
  const selectedPointIndices = useEditorStore(state => state.selectedPointIndices);
  const editingPathId = useEditorStore(state => state.editingPathId);
  const selectPath = useEditorStore(state => state.selectPath);
  const setCodeMappings = useEditorStore(state => state.setCodeMappings);
  const setSVGDocument = useEditorStore(state => state.setSVGDocument);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const codeEditorRef = useRef<CodeEditorRef>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [svgCode, setSvgCode] = useState('');
  const parseTimeoutRef = useRef<number | null>(null);
  const syncSourceRef = useRef<'canvas' | 'code' | null>(null);
  const isCodeEditingRef = useRef<boolean>(false);
  const preservedEditStateRef = useRef<{ pathId: string | null; pointIndices: number[] }>({ pathId: null, pointIndices: [] });
  
  // Generate formatted SVG code with mappings
  useEffect(() => {
    const result = generateSVGCodeWithMappings(svgDocument);
    setSvgCode(result.code);
    setCodeMappings(result.mappings);
  }, [svgDocument, setCodeMappings]);
  
  // Canvas → Code sync: When path is selected, highlight in code
  useEffect(() => {
    // Don't scroll/highlight if selection came from code editor
    if (syncSourceRef.current === 'code') {
      syncSourceRef.current = null;
      return;
    }
    
    if (!showCodePanel || !codeEditorRef.current || selectedPathIds.length === 0) {
      if (codeEditorRef.current) {
        codeEditorRef.current.clearHighlights();
      }
      return;
    }
    
    const codeMappings = useEditorStore.getState().codeMappings;
    if (!codeMappings) return;
    
    const firstPathId = selectedPathIds[0];
    const mapping = codeMappings.get(firstPathId);
    
    if (mapping) {
      // Scroll to and highlight the path in code
      codeEditorRef.current.scrollToLine(mapping.elementRange.start.line);
      codeEditorRef.current.highlightRange(
        mapping.elementRange.start.line,
        mapping.elementRange.end.line
      );
    }
  }, [selectedPathIds, showCodePanel]);
  
  // Point-level sync: When control point is selected, highlight specific command in d attribute
  useEffect(() => {
    // Don't scroll/highlight if selection came from code editor
    if (syncSourceRef.current === 'code') {
      syncSourceRef.current = null;
      return;
    }
    
    if (!showCodePanel || !codeEditorRef.current || !editingPathId || selectedPointIndices.length === 0) {
      return;
    }
    
    const codeMappings = useEditorStore.getState().codeMappings;
    if (!codeMappings) return;
    
    const mapping = codeMappings.get(editingPathId);
    if (!mapping || !mapping.pointMappings || mapping.pointMappings.length === 0) {
      return;
    }
    
    // Highlight the command for the first selected point
    const firstPointIndex = selectedPointIndices[0];
    const pointMapping = mapping.pointMappings.find(pm => pm.pointIndex === firstPointIndex);
    
    if (pointMapping && pointMapping.commandRange) {
      // Highlight just the specific command coordinates (character-level)
      console.log(`Highlighting point ${firstPointIndex} (${pointMapping.commandType} command) at line ${pointMapping.commandRange.start.line}, columns ${pointMapping.commandRange.start.column}-${pointMapping.commandRange.end.column}`);
      codeEditorRef.current.highlightCharacterRange(
        pointMapping.commandRange.start.line,
        pointMapping.commandRange.start.column,
        pointMapping.commandRange.end.column
      );
    }
  }, [editingPathId, selectedPointIndices, showCodePanel]);
  
  // Handle resize
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);
  
  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseY = e.clientY - containerRect.top;
    const newHeight = 1 - (mouseY / containerRect.height);
    
    setCodePanelHeight(newHeight);
  }, [isResizing, setCodePanelHeight]);
  
  const handleResizeMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);
  
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMouseMove);
      document.addEventListener('mouseup', handleResizeMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleResizeMouseMove, handleResizeMouseUp]);
  
  // Handle cursor position change in code editor (Code → Canvas sync)
  const handleCursorChange = useCallback((line: number, column: number) => {
    const codeMappings = useEditorStore.getState().codeMappings;
    const setEditingPath = useEditorStore.getState().setEditingPath;
    const setSelectedPoint = useEditorStore.getState().setSelectedPoint;
    if (!codeMappings) return;
    
    const pathMapping = findPathAtLine(codeMappings, line);
    if (!pathMapping) return;
    
    // Select the path if not already selected
    if (pathMapping.pathId !== selectedPathIds[0]) {
      syncSourceRef.current = 'code';
      selectPath(pathMapping.pathId);
    }
    
    // Check if cursor is within the d attribute range
    if (pathMapping.dRange && 
        line === pathMapping.dRange.start.line && 
        column >= pathMapping.dRange.start.column && 
        column <= pathMapping.dRange.end.column) {
      
      // Check if cursor is within a specific point's command range
      if (pathMapping.pointMappings) {
        for (const pointMapping of pathMapping.pointMappings) {
          const cmdRange = pointMapping.commandRange;
          if (line === cmdRange.start.line && 
              column >= cmdRange.start.column && 
              column <= cmdRange.end.column) {
            // Found the point! Enter edit mode and select it
            syncSourceRef.current = 'code';
            setEditingPath(pathMapping.pathId);
            setSelectedPoint(pointMapping.pointIndex);
            return;
          }
        }
      }
    }
  }, [selectedPathIds, selectPath]);
  
  // Handle selection change in code editor
  const handleSelectionChange = useCallback((startLine: number, endLine: number) => {
    // TODO: Handle multi-line selections (could select multiple paths)
    console.log('Selection:', startLine, '-', endLine);
  }, []);
  
  // Handle code changes with debounced parsing
  const handleCodeChange = useCallback((newCode: string) => {
    // Update local state immediately for responsive typing
    setSvgCode(newCode);
    
    // Preserve current edit state before parsing
    const currentEditingPathId = useEditorStore.getState().editingPathId;
    const currentSelectedPointIndices = useEditorStore.getState().selectedPointIndices;
    if (currentEditingPathId) {
      preservedEditStateRef.current = {
        pathId: currentEditingPathId,
        pointIndices: [...currentSelectedPointIndices]
      };
      isCodeEditingRef.current = true;
    }
    
    // Clear existing timeout
    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
    }
    
    // Debounce parsing (300ms delay)
    parseTimeoutRef.current = setTimeout(() => {
      try {
        const newDocument = parseSVG(newCode);
        setSVGDocument(newDocument, true); // Skip history - this is just syncing from code editor
        
        // Restore edit state after document updates
        if (isCodeEditingRef.current && preservedEditStateRef.current.pathId) {
          const setEditingPath = useEditorStore.getState().setEditingPath;
          const setSelectedPoint = useEditorStore.getState().setSelectedPoint;
          
          // Re-enter edit mode with preserved state
          setTimeout(() => {
            setEditingPath(preservedEditStateRef.current.pathId);
            if (preservedEditStateRef.current.pointIndices.length > 0) {
              setSelectedPoint(preservedEditStateRef.current.pointIndices[0]);
            }
            isCodeEditingRef.current = false;
          }, 0);
        }
      } catch (error) {
        console.error('SVG parse error:', error);
        isCodeEditingRef.current = false;
        // Don't update document on parse errors - keep showing current state
      }
    }, 300);
  }, [setSVGDocument]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div ref={containerRef} className="flex-1 flex flex-col relative overflow-hidden">
      {/* Canvas (top part) */}
      {!showCodePanel ? (
        <Canvas />
      ) : (
        <div 
          style={{ height: `${(1 - codePanelHeight) * 100}%`, minHeight: '20%' }}
          className="relative flex flex-col overflow-hidden"
        >
          <Canvas />
        </div>
      )}
      
      {/* Resize Handle */}
      {showCodePanel && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="h-1 bg-border hover:bg-accent-primary cursor-ns-resize transition-colors flex items-center justify-center group"
        >
          <div className="w-12 h-1 bg-border group-hover:bg-accent-primary rounded-full transition-colors" />
        </div>
      )}
      
      {/* Code Editor (bottom part) */}
      {showCodePanel && (
        <div
          style={{ height: `${codePanelHeight * 100}%` }}
          className="relative bg-[#1e1e1e] border-t border-border"
        >
          <CodeEditor
            ref={codeEditorRef}
            value={svgCode}
            height="100%"
            onChange={handleCodeChange}
            onCursorChange={handleCursorChange}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      )}
    </div>
  );
};

export default CanvasWithCode;
