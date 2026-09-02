import React from 'react';
import { createUsePuck, type Config } from '@puckeditor/core';
import type { EditorComponents } from './puckEditorTypes';
import type { PageDesignProps } from './pageDesignTokens';
import type { CanvasRangeAnchor } from './canvasContextState';
import type { CanvasElementSelection } from './canvasEditingContract';
import { PC_EDITOR_VIEWPORT_WIDTH, type EditorViewportPolicy } from './editorViewportPolicy';

export const EditorViewportPolicyContext = React.createContext<EditorViewportPolicy>({
  canEdit: false,
  canvasWidth: PC_EDITOR_VIEWPORT_WIDTH,
  hostSupported: false,
  mode: 'preview',
  status: '현재 기기에서는 편집할 수 없습니다.',
});

export interface CanvasEditingUiValue {
  selection: CanvasElementSelection | null;
  setSelection: React.Dispatch<React.SetStateAction<CanvasElementSelection | null>>;
  rangeEditingActive: boolean;
  rangeAnchor: CanvasRangeAnchor | null;
  mediaDialogOpen: boolean;
  setMediaDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  routeDialogOpen: boolean;
  setRouteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  textToolsOpen: boolean;
  setTextToolsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const CanvasEditingUiContext = React.createContext<CanvasEditingUiValue | null>(null);

export const usePageBuilderPuck = createUsePuck<Config<EditorComponents, PageDesignProps>>();

