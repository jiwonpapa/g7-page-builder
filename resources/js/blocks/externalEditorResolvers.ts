import type { Fields } from '@puckeditor/core';
import {
  externalChanged, rawEditorData, wrappedReadOnly, rawCallbackItem, rawCallbackState,
  type ExternalEditorProps, type ExternalPayload, type ExternalRawConfig, type ExternalWrappedConfig,
} from './externalEditorData';

export function wrapExternalFields(fields: Fields<ExternalPayload>): Fields<ExternalEditorProps> {
  return { payload: { type: 'object', label: '블록 설정', objectFields: fields } };
}

function rawFields(fields: Fields<ExternalEditorProps>): Fields<ExternalPayload> {
  return fields.payload?.type === 'object' ? fields.payload.objectFields : {};
}

export function externalEditorResolvers(component: ExternalRawConfig): Pick<ExternalWrappedConfig,
  'resolveData' | 'resolveFields' | 'resolvePermissions'> {
  const { resolveData, resolveFields, resolvePermissions } = component;
  return {
    resolveData: resolveData ? async (data, params) => {
      const result = await resolveData(rawEditorData(data), {
        ...params,
        parent: rawCallbackItem(params.parent),
        changed: externalChanged(data, params.lastData),
        lastData: params.lastData ? rawEditorData(params.lastData) : null,
      });
      const updates = { ...result.props };
      // resolveData receives Puck's identity. It must never overwrite a pack's
      // independently editable payload.id or rename the Puck instance.
      delete updates.id;
      return {
        props: { ...data.props, payload: { ...data.props.payload, ...updates } },
        ...(result.readOnly ? { readOnly: wrappedReadOnly(result.readOnly) } : {}),
      };
    } : undefined,
    resolveFields: resolveFields ? async (data, params) => wrapExternalFields(
      await resolveFields(rawEditorData(data), {
        ...params,
        parent: rawCallbackItem(params.parent),
        changed: externalChanged(data, params.lastData),
        lastData: params.lastData ? rawEditorData(params.lastData) : null,
        appState: rawCallbackState(params.appState),
        fields: rawFields(params.fields),
        lastFields: rawFields(params.lastFields),
      }),
    ) : undefined,
    resolvePermissions: resolvePermissions ? async (data, params) => resolvePermissions(rawEditorData(data), {
      ...params,
      appState: rawCallbackState(params.appState),
        parent: rawCallbackItem(params.parent),
      changed: externalChanged(data, params.lastData),
      lastData: params.lastData ? rawEditorData(params.lastData) : null,
    }) : undefined,
  };
}
