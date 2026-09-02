import React from 'react';
import type { ExternalRawConfig, ExternalWrappedConfig } from './externalEditorData';
import { externalEditorResolvers, wrapExternalFields } from './externalEditorResolvers';

/** Puck owns the outer props; the pack owns every key inside payload. */
export function adaptExternalEditor(component: ExternalRawConfig): ExternalWrappedConfig {
  const { render: Render, resolveData: _data, resolveFields: _fields, resolvePermissions: _permissions, ...presentation } = component;
  return {
    ...presentation,
    defaultProps: { payload: { ...component.defaultProps }, metadata: { emptySlotNames: [] } },
    fields: wrapExternalFields(component.fields ?? {}),
    render: ({ payload, id, puck, editMode }) => <Render {...component.defaultProps} {...payload} id={id} puck={puck} editMode={editMode} />,
    ...externalEditorResolvers(component),
  };
}
