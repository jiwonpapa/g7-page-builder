import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AppState, PuckContext } from '@puckeditor/core';
import { adaptExternalEditor } from '../../resources/js/blocks/externalEditorAdapter';
import {
  canonicalExternalMetadata, canonicalExternalProps, externalEditorProps, externalChanged,
  withEditorContextPatch, withEditorMotion, type ExternalRawConfig, type ExternalWrappedData,
} from '../../resources/js/blocks/externalEditorData';

const puck: PuckContext = { renderDropZone: () => null, metadata: {}, isEditing: true, dragRef: null };
const state: AppState = { data: { root: { props: {} }, content: [] }, ui: {
  leftSideBarVisible: true, rightSideBarVisible: true, itemSelector: null, arrayState: {},
  componentList: {}, previewMode: 'edit', isDragging: false, viewports: { current: { width: 1200, height: 'auto' }, controlsVisible: false, options: [] },
  field: {}, plugin: { current: null },
} };
const readOnly: Record<string, boolean> = { 'payload.title': true };
const data = (): ExternalWrappedData => ({ props: { id: 'runtime-id', payload: { id: 'raw-id', title: 'Title', detail: { count: 1 }, marker: { $$typeof: 'business-json', count: 1 }, record: { type: 'External_Example', props: { id: 'business', payload: { title: 'raw' }, other: 'preserve' } } },
  metadata: { emptySlotNames: ['empty'], visibility: { audience: 'guest' } } }, readOnly });

describe('external ComponentConfig adapter', () => {
  it('preserves display defaults and runtime controls without altering raw reserved keys', () => {
    const callback = () => 'editor-only';
    const component = adaptExternalEditor({ defaultProps: { title: 'Default', callback }, fields: {},
      render: (props) => <span>{`${props.title}:${props.id}:${props.puck.isEditing}:${props.editMode}:${props.callback === callback}`}</span> });
    const source = { id: 'raw', puck: 'raw', editMode: 'raw' };
    expect(renderToStaticMarkup(<component.render payload={source} id="instance" puck={puck} editMode />))
      .toBe('<span>Default:instance:true:true:true</span>');
    expect(source).toEqual({ id: 'raw', puck: 'raw', editMode: 'raw' });
    expect(component.defaultProps?.payload.callback).toBe(callback);
  });

  it('merges partial resolver updates without replacing payload, metadata or the Puck identity', async () => {
    const source = data();
    const component = adaptExternalEditor({ fields: {}, render: () => <></>, resolveData: (input, params) => {
      expect(input.props.id).toBe('runtime-id');
      expect(input.props.record).toEqual(source.props.payload.record);
      expect(input.readOnly).toEqual({ title: true });
      expect(params.lastData?.props.title).toBe('Old');
      expect(params.changed.title).toBe(true);
      expect(params.changed.id).toBe(false);
      const detail = input.props.detail;
      const marker = input.props.marker;
      if (marker && typeof marker === 'object' && 'count' in marker) marker.count = 99;
      if (detail && typeof detail === 'object' && 'count' in detail) detail.count = 99;
      return { props: { title: 'Resolved', id: 'do-not-rename' }, readOnly: { title: false } };
    } });
    const previous = data(); previous.props.payload.title = 'Old'; previous.props.payload.id = 'previous-raw-id';
    const result = await component.resolveData?.(source, { changed: {}, lastData: previous, metadata: {}, trigger: 'replace', parent: null, root: { props: {} } });
    expect(result?.props).toEqual({ ...source.props, payload: { ...source.props.payload, title: 'Resolved' } });
    expect(result?.readOnly).toEqual({ 'payload.title': false });
    expect(source.props.payload.detail).toEqual({ count: 1 });
    expect(source.props.payload.marker).toEqual({ $$typeof: 'business-json', count: 1 });
    const duplicate = data(); duplicate.props.id = 'second-runtime-id';
    expect(externalChanged(duplicate, source).id).toBe(true);
  });

  it('presents raw public component names, fields and appState to dynamic resolvers', async () => {
    const source = data(), item = { type: 'External_Example', ...source };
    const appState: AppState = { ...state, data: { ...state.data, content: [item], zones: { nested: [item] } } };
    const raw: ExternalRawConfig = { fields: { title: { type: 'text' } }, render: () => <></>,
      resolveFields: (input, params) => {
        expect(params.appState.data.content[0]).toEqual({ type: 'Example', props: input.props, readOnly: { title: true } });
        expect(params.appState.data.zones?.nested[0].props.title).toBe('Title');
        expect(params.fields).toEqual(raw.fields);
        expect(params.lastFields).toEqual(raw.fields);
        expect(params.parent?.type).toBe('Example');
        return { id: { type: 'text', label: 'Payload identity' } };
      },
      resolvePermissions: (_input, params) => {
        expect(params.appState.data.content[0].props.title).toBe('Title');
        expect(params.parent?.props.title).toBe('Title');
        return { duplicate: false };
      },
    };
    const component = adaptExternalEditor(raw), fields = component.fields;
    if (!fields) throw new Error('Missing adapted fields');
    const result = await component.resolveFields?.(source, { changed: {}, fields, lastFields: fields, lastData: null, metadata: {}, appState, parent: item });
    expect(result?.payload).toEqual({ type: 'object', label: '블록 설정', objectFields: { id: { type: 'text', label: 'Payload identity' } } });
    expect(await component.resolvePermissions?.(source, { changed: {}, lastPermissions: {}, permissions: {}, appState, lastData: null, parent: item })).toEqual({ duplicate: false });
    expect(appState.data.content[0].type).toBe('External_Example');
    expect(appState.data.content[0].props.payload).toEqual(source.props.payload);
  });

  it('preserves omitted defaults and named empty slots while persisting deliberate edits', () => {
    const props = externalEditorProps({ instance_id: 'id', type: 'vendor.example', block_version: 1,
      props: {}, slots: { first: [], second: [] } }, { title: 'Default', nested: { enabled: true } });
    expect(props.payload).toEqual({ title: 'Default', nested: { enabled: true } });
    expect(canonicalExternalProps(props)).toEqual({});
    expect(canonicalExternalMetadata(props.metadata)).toEqual({ slots: { first: [], second: [] } });
    expect(canonicalExternalProps({ ...props, payload: { ...props.payload, title: 'Edited' } })).toEqual({ title: 'Edited' });
    expect(canonicalExternalMetadata(externalEditorProps({ instance_id: 'id', type: 'vendor.example', block_version: 1, props: {} }).metadata)).toEqual({});
  });

  it('routes common motion and audience actions to metadata without changing colliding pack props', () => {
    const original = { type: 'External_Example', props: { ...data().props,
      payload: { motion: 'raw', __g7pbVisibilityAudience: 'raw', responsiveOverrides: 'raw' } } };
    const motion = { preset: 'reveal', intensity: 'subtle', trigger: 'once', stagger_ms: 60 } as const;
    const changed = withEditorContextPatch(withEditorMotion(original, motion), { __g7pbVisibilityAudience: 'member' });
    expect(canonicalExternalProps(changed.props)).toEqual(original.props.payload);
    expect(canonicalExternalMetadata(changed.props.metadata)).toEqual({ motion, visibility: { audience: 'member' }, slots: { empty: [] } });
    expect(original.props.metadata?.visibility).toEqual({ audience: 'guest' });
    const builtin = { type: 'Hero', props: { id: 'hero', heading: 'Text' } };
    expect(withEditorMotion(builtin, motion).props).toEqual({ ...builtin.props, motion });
  });
});
