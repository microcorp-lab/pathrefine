// Stub component - PRO feature not available in open source version
export interface ColorMapping {
  originalColor: string;
  variableName: string;
  pathCount: number;
}

interface AutoColorizePanelProps {
  colorMappings: ColorMapping[];
  useCssVariables: boolean;
  onUseCssVariablesChange: (value: boolean) => void;
  onVariableNameChange: (originalColor: string, newName: string) => void;
  showCopyCSS?: boolean;
}

export const AutoColorizePanel = (_props: AutoColorizePanelProps) => null;
