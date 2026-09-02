import type { AppState, ComponentConfig, ComponentData } from '@puckeditor/core';
import type { PageBuilderBlock } from '../documents/types';

export type ExternalEditorName = `External_${string}`;
export type ExternalPayload = Record<string, unknown>;
export type ExternalBlockMetadata = Pick<PageBuilderBlock, 'motion' | 'visibility' | 'responsive'> & {
  emptySlotNames?: string[];
  omittedDefaults?: ExternalPayload;
};
export interface ExternalEditorProps {
  payload: ExternalPayload;
  metadata?: ExternalBlockMetadata;
}
export type ExternalEditorComponents = { [Name in ExternalEditorName]: ExternalEditorProps };
export type ExternalEditorItem = ComponentData<ExternalEditorProps, ExternalEditorName>;
export type ExternalRawConfig = ComponentConfig<ExternalPayload>;
export type ExternalWrappedConfig = ComponentConfig<ExternalEditorProps>;
export type ExternalRawData = Parameters<NonNullable<ExternalRawConfig['resolveData']>>[0];
export type ExternalWrappedData = Parameters<NonNullable<ExternalWrappedConfig['resolveData']>>[0];

export function externalEditorName(name: string): ExternalEditorName { return `External_${name}`; }

export function isExternalEditorName(name: string): name is ExternalEditorName {
  return /^External_[A-Za-z][A-Za-z0-9]{1,127}$/.test(name);
}

export function isExternalEditorItem<Item extends { type: string }>(item: Item): item is Extract<Item, { type: ExternalEditorName }> {
  return isExternalEditorName(item.type);
}

export function externalEditorProps(block: PageBuilderBlock, defaults: ExternalPayload = {}): ExternalEditorProps {
  return {
    payload: { ...defaults, ...structuredClone(block.props) },
    metadata: {
      omittedDefaults: Object.fromEntries(Object.entries(defaults).filter(([key]) => !Object.hasOwn(block.props, key))),
      ...structuredClone({
        ...(block.motion !== undefined ? { motion: block.motion } : {}),
        ...(block.visibility !== undefined ? { visibility: block.visibility } : {}),
        ...(block.responsive !== undefined ? { responsive: block.responsive } : {}),
        ...(block.slots !== undefined ? { emptySlotNames: Object.keys(block.slots) } : {}),
      }),
    },
  };
}

export function rawEditorData(data: ExternalWrappedData): ExternalRawData {
  return {
    props: { ...Object.fromEntries(Object.entries(data.props.payload).map(([key, value]) => [key, copyValue(value)])), id: data.props.id },
    ...(data.readOnly ? { readOnly: rawReadOnly(data.readOnly) } : {}),
  };
}

export function rawReadOnly(readOnly: Record<string, boolean | undefined>): Record<string, boolean | undefined> {
  return Object.fromEntries(Object.entries(readOnly)
    .filter(([name]) => name.startsWith('payload.'))
    .map(([name, value]) => [name.slice('payload.'.length), value]));
}

export function wrappedReadOnly(readOnly: Record<string, boolean | undefined>): Record<string, boolean | undefined> {
  return Object.fromEntries(Object.entries(readOnly).map(([name, value]) => [`payload.${name}`, value]));
}

export function externalChanged(data: ExternalWrappedData, previous: ExternalWrappedData | null): Record<string, boolean> {
  const current: ExternalPayload = rawEditorData(data).props, last: ExternalPayload = previous ? rawEditorData(previous).props : {};
  return Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(last)])]
    .map((key) => [key, JSON.stringify(current[key]) !== JSON.stringify(last[key])]));
}

export function canonicalExternalProps(props: ExternalEditorProps): ExternalPayload {
  const payload = { ...props.payload };
  for (const [key, initial] of Object.entries(props.metadata?.omittedDefaults ?? {})) {
    if (JSON.stringify(payload[key]) === JSON.stringify(initial)) delete payload[key];
  }
  return structuredClone(payload);
}

export function canonicalExternalMetadata(metadata: ExternalBlockMetadata = {}): Pick<PageBuilderBlock, 'motion' | 'visibility' | 'responsive' | 'slots'> {
  const { emptySlotNames, omittedDefaults: _defaults, ...values } = metadata;
  return { ...structuredClone(values), ...(emptySlotNames ? { slots: Object.fromEntries(emptySlotNames.map((name) => [name, []])) } : {}) };
}

function objectValue(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Component payload is opaque even when business JSON happens to resemble a
// Puck node. Clone values without interpreting names or shape inside payload.
function copyValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copyValue);
  if (!objectValue(value) || typeof value.$$typeof === 'symbol') return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyValue(child)]));
}

export function rawCallbackItem(item: ComponentData | null): ComponentData | null {
  if (!item) return null;
  const props: Record<string, unknown> = Object.fromEntries(Object.entries(item.props).map(([key, value]) => [key, copyValue(value)]));
  return isExternalEditorName(item.type) && objectValue(props.payload)
    ? { ...item, type: item.type.slice('External_'.length), props: { ...props.payload, id: item.props.id }, ...(item.readOnly ? { readOnly: rawReadOnly(item.readOnly) } : {}) }
    : { ...item, props: { ...props, id: item.props.id } };
}

export function rawCallbackState(state: AppState): AppState {
  return { ...state, data: { ...state.data,
    content: state.data.content.map((item) => rawCallbackItem(item) ?? item),
    ...(state.data.zones ? { zones: Object.fromEntries(Object.entries(state.data.zones).map(([name, items]) =>
      [name, items.map((item) => rawCallbackItem(item) ?? item)])) } : {}) } };
}

type EditorItemShape = { type: string; props: Record<string, unknown> };
export function editorContextProps(item: EditorItemShape): Record<string, unknown> {
  if (!isExternalEditorName(item.type) || !objectValue(item.props.payload)) return item.props;
  const metadata = objectValue(item.props.metadata) ? item.props.metadata : {};
  const visibility = objectValue(metadata.visibility) ? metadata.visibility : {};
  return { ...item.props.payload, __g7pbVisibilityAudience: visibility.audience ?? 'all' };
}

export function withEditorMotion<Item extends EditorItemShape>(item: Item, motion: PageBuilderBlock['motion']): Item {
  if (!isExternalEditorName(item.type)) return { ...item, props: { ...item.props, motion } };
  return { ...item, props: { ...item.props,
    metadata: { ...(objectValue(item.props.metadata) ? item.props.metadata : {}), motion } } };
}

export function withEditorContextPatch<Item extends EditorItemShape>(item: Item, patch: Record<string, unknown>): Item {
  if (!isExternalEditorName(item.type)) return { ...item, props: { ...item.props, ...patch } };
  const { __g7pbVisibilityAudience: audience, ...payloadPatch } = patch;
  const metadata = objectValue(item.props.metadata) ? item.props.metadata : {};
  const visibility = objectValue(metadata.visibility) ? metadata.visibility : {};
  return { ...item, props: { ...item.props,
    payload: { ...(objectValue(item.props.payload) ? item.props.payload : {}), ...payloadPatch },
    metadata: { ...metadata, ...(audience === 'all' || audience === 'guest' || audience === 'member'
      ? { visibility: { ...visibility, audience } } : {}) } } };
}
