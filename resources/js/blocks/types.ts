export type BlockPackKind = 'data' | 'code';
export type BlockPackState = 'staged' | 'enabled' | 'disabled' | 'retired' | 'quarantined';

export interface LocalizedBlockText {
  ko: string;
  en?: string;
}

export interface BlockPackCompatibility {
  page_builder: string;
  php: string;
  g7: string;
}

export interface BlockPackPublisher {
  id: string;
  name: string;
  key_id?: string;
}

export interface BlockDefinitionDescriptor {
  block_id: string;
  block_version: number;
  category: string;
  label: LocalizedBlockText;
  description: LocalizedBlockText;
  thumbnail: string;
  schema_ref: string;
  editor_component: string;
  compiler: string;
  capabilities: string[];
}

export interface BlockPresetDescriptor<TProps extends Record<string, unknown> = Record<string, unknown>> {
  preset_id: string;
  block_id: string;
  block_version: number;
  category: string;
  label: LocalizedBlockText;
  description: LocalizedBlockText;
  thumbnail: string;
  props: TProps;
}

export interface BlockPackRuntimeDescriptor {
  provider: string;
  editor: string;
  styles: string[];
}

export interface BlockPackManifest {
  manifest_version: 'g7pb-block-pack/v1';
  pack_id: string;
  pack_version: string;
  kind: BlockPackKind;
  publisher: BlockPackPublisher;
  compatibility: BlockPackCompatibility;
  blocks: BlockDefinitionDescriptor[];
  presets: BlockPresetDescriptor[];
  runtime?: BlockPackRuntimeDescriptor;
  files: Record<string, string>;
}

export interface BlockCatalogItem {
  catalog_id: string;
  kind: 'definition' | 'preset';
  block_id: string;
  block_version: number;
  pack_id: string;
  pack_version: string;
  category: string;
  label: LocalizedBlockText;
  description: LocalizedBlockText;
  thumbnail: string;
  editor_component: string;
  favorite: boolean;
  insertable: boolean;
  preset_props: Record<string, unknown> | null;
}

export interface BlockCatalogResource {
  items: BlockCatalogItem[];
  categories: string[];
}

export interface BlockPackResource {
  pack_id: string;
  pack_version: string;
  kind: BlockPackKind;
  publisher: BlockPackPublisher;
  state: BlockPackState;
  source: 'builtin' | 'local' | 'github';
  source_uri: string | null;
  archive_sha256: string | null;
  blocks: number;
  presets: number;
  runtime_active: boolean;
  editor_asset_url: string | null;
  style_asset_urls: string[];
  usage: { documents: number; revisions: number } | null;
  installed_at: string | null;
  updated_at: string | null;
}

export interface BlockPackListResource {
  items: BlockPackResource[];
}

export interface BlockPackReleaseResource {
  repository: string;
  tag: string;
  version: string;
  asset_name: string;
  asset_bytes: number;
  sha256: string;
  release_url: string;
  published_at: string;
}

export interface GitHubBlockPackCheckResource {
  release: BlockPackReleaseResource;
  installed_version: string | null;
  update_available: boolean;
}
