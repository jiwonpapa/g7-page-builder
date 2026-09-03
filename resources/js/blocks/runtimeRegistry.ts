import React from 'react';
import { adaptExternalEditor } from './externalEditorAdapter';
import { externalEditorName, type ExternalEditorName, type ExternalWrappedConfig } from './externalEditorData';
import {
  externalEditorRegistrations,
  registerExternalEditor,
  type ExternalBlockEditorRegistration,
} from './externalEditorRegistryData';

export {
  catalogEditorName,
  externalBlockForComponent,
  externalBlockForDocument,
  externalEditorDefaults,
  hasExternalEditorRegistration,
  isEditorComponentRegistered,
  type ExternalBlockEditorDescriptor,
  type ExternalBlockEditorRegistration,
} from './externalEditorRegistryData';

interface BlockPackEditorBridge {
  React: typeof React;
  register: (registration: ExternalBlockEditorRegistration) => void;
}

declare global {
  interface Window {
    G7PageBuilderBlockPacks?: BlockPackEditorBridge;
  }
}

if (typeof window !== 'undefined') {
  window.G7PageBuilderBlockPacks = { React, register: registerExternalEditor };
}

export function externalEditorComponents(): Record<ExternalEditorName, ExternalWrappedConfig> {
  const components: Record<ExternalEditorName, ExternalWrappedConfig> = {};
  for (const registration of externalEditorRegistrations()) {
    for (const [key, component] of Object.entries(registration.components)) {
      const name = externalEditorName(key);
      if (Object.prototype.hasOwnProperty.call(components, name)) {
        throw new Error(`External Block Pack editor component is duplicated: ${key}`);
      }
      components[name] = adaptExternalEditor(component);
    }
  }

  return components;
}
