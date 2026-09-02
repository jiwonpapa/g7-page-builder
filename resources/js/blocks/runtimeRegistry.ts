import React from 'react';
import type { ComponentConfig } from '@puckeditor/core';
import { BUILTIN_BLOCK_DEFINITIONS } from './builtinCatalog';
import { adaptExternalEditor } from './externalEditorAdapter';
import { externalEditorName, type ExternalEditorName, type ExternalWrappedConfig } from './externalEditorData';
import type { BlockCatalogItem } from './types';

export interface ExternalBlockEditorDescriptor {
  block_id: string;
  block_version: number;
  editor_component: string;
}

export interface ExternalBlockEditorRegistration {
  pack_id: string;
  pack_version: string;
  blocks: ExternalBlockEditorDescriptor[];
  components: Record<string, ComponentConfig<Record<string, unknown>>>;
}

interface BlockPackEditorBridge {
  React: typeof React;
  register: (registration: ExternalBlockEditorRegistration) => void;
}

declare global {
  interface Window {
    G7PageBuilderBlockPacks?: BlockPackEditorBridge;
  }
}

const registrations = new Map<string, ExternalBlockEditorRegistration>();
const builtinEditorComponents = new Set(BUILTIN_BLOCK_DEFINITIONS.map((definition) => definition.editor_component));

function registrationIdentity(packId: string, packVersion: string): string {
  return `${packId}@${packVersion}`;
}

function register(registration: ExternalBlockEditorRegistration): void {
  const identity = registrationIdentity(registration.pack_id, registration.pack_version);
  if (!/^[a-z0-9][a-z0-9._-]{1,63}\/[a-z0-9][a-z0-9._-]{1,63}$/.test(registration.pack_id)
    || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(registration.pack_version)
    || !Array.isArray(registration.blocks)
    || typeof registration.components !== 'object'
    || registration.components === null) {
    throw new Error('External Block Pack editor registration is invalid.');
  }
  if (registrations.has(identity)) {
    throw new Error(`External Block Pack editor is already registered: ${identity}`);
  }
  const seenComponents = new Set<string>();
  const registeredComponents = new Set(
    Array.from(registrations.values()).flatMap((candidate) => candidate.blocks.map((block) => block.editor_component)),
  );
  for (const block of registration.blocks) {
    if (!/^[a-z0-9][a-z0-9._\/-]{1,127}$/.test(block.block_id)
      || !Number.isInteger(block.block_version) || block.block_version < 1
      || !/^[A-Za-z][A-Za-z0-9]{1,127}$/.test(block.editor_component)
      || !Object.prototype.hasOwnProperty.call(registration.components, block.editor_component)
      || seenComponents.has(block.editor_component)
      || builtinEditorComponents.has(block.editor_component)
      || registeredComponents.has(block.editor_component)) {
      throw new Error('External Block Pack editor block registration is invalid.');
    }
    seenComponents.add(block.editor_component);
  }
  const componentKeys = Object.keys(registration.components);
  if (componentKeys.length !== seenComponents.size
    || componentKeys.some((component) => !seenComponents.has(component))) {
    throw new Error('External Block Pack editor components must exactly match its manifest descriptors.');
  }
  registrations.set(identity, registration);
}

if (typeof window !== 'undefined') {
  window.G7PageBuilderBlockPacks = { React, register };
}

export function hasExternalEditorRegistration(packId: string, packVersion: string): boolean {
  return registrations.has(registrationIdentity(packId, packVersion));
}

export function externalEditorComponents(): Record<ExternalEditorName, ExternalWrappedConfig> {
  const components: Record<ExternalEditorName, ExternalWrappedConfig> = {};
  for (const registration of registrations.values()) {
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

export function externalBlockForDocument(blockId: string, blockVersion: number): ExternalBlockEditorDescriptor | null {
  for (const registration of registrations.values()) {
    const block = registration.blocks.find((candidate) =>
      candidate.block_id === blockId && candidate.block_version === blockVersion);
    if (block) return block;
  }

  return null;
}

export function externalBlockForComponent(editorComponent: string): ExternalBlockEditorDescriptor | null {
  for (const registration of registrations.values()) {
    const block = registration.blocks.find((candidate) => externalEditorName(candidate.editor_component) === editorComponent);
    if (block) return block;
  }

  return null;
}

export function isEditorComponentRegistered(editorComponent: string): boolean {
  return Array.from(registrations.values()).some((registration) =>
    Object.prototype.hasOwnProperty.call(registration.components, editorComponent));
}

function ownsName<Name extends string>(components: Record<Name, unknown>, name: string): name is Name {
  return Object.prototype.hasOwnProperty.call(components, name);
}

export function catalogEditorName<Name extends string>(
  item: Pick<BlockCatalogItem, 'block_id' | 'block_version' | 'editor_component'>,
  builtins: Record<Name, unknown>,
): Name | ExternalEditorName | null {
  if (ownsName(builtins, item.editor_component)) return item.editor_component;
  const descriptor = externalBlockForDocument(item.block_id, item.block_version);
  return descriptor?.editor_component === item.editor_component ? externalEditorName(descriptor.editor_component) : null;
}

export function externalEditorDefaults(component: string): Record<string, unknown> {
  for (const registration of registrations.values()) {
    const definition = registration.components[component];
    if (definition) return definition.defaultProps ?? {};
  }
  return {};
}
