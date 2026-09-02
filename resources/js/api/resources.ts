import type { InquiryFormKind, PageBuilderBlock, PageBuilderDocument, SitePartDocument, SiteShellLink } from '../documents/types';

export interface RouteCatalogEntry {
  id: string;
  label: string;
  category: string;
  path: string;
  action?: 'logout';
  auth_required: boolean;
  guest_only: boolean;
  parameters: string[];
  parameter_sources: Record<string, 'page' | 'board' | 'category' | 'product' | 'manual'>;
  source: {
    kind: 'template' | 'module' | 'core';
    identifier: string | null;
  };
}

export interface RouteCatalogResource {
  active_template: string;
  routes: RouteCatalogEntry[];
}

export interface SectionPatternResource {
  schema_version: 'g7-page-builder/section-pattern/v1';
  pattern_id: string;
  title: string;
  category: string;
  source_document_schema: 'g7-page-builder/v2';
  section: PageBuilderBlock;
  required_blocks: string[];
  asset_references: string[];
  preview: { kind: 'section-summary'; block_count: number };
  created_at: string;
  updated_at: string;
  compatible: boolean;
  compatibility_error: string | null;
}

export interface SectionPatternListResource {
  items: SectionPatternResource[];
}

export interface DocumentResource {
  document: PageBuilderDocument;
  title: string;
  lock_version: number;
  revision: number;
  public_url: string | null;
  active_artifact_sha256: string | null;
  is_home: boolean;
  status: 'draft' | 'published' | 'published_with_changes' | 'archived';
  has_unpublished_changes: boolean;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  archived_at: string | null;
}

export interface RevisionSummary {
  revision: number;
  schema_version: string;
  title: string;
  slug: string;
  locale: string;
  block_count: number;
  author_id: number | null;
  created_at: string;
}

export interface RevisionListResource {
  current_revision: number;
  items: RevisionSummary[];
}

export interface RevisionResource extends RevisionSummary {
  document: PageBuilderDocument;
}

export interface DocumentListResource {
  items: DocumentResource[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
  };
}

export interface MediaAssetResource {
  id: string;
  url: string;
  original_name: string;
  mime_type: string;
  bytes: number;
  width: number;
  height: number;
  kind: MediaAssetKind;
  created_at: string;
}

export type MediaAssetKind = 'image' | 'download';

export interface MediaListResource {
  items: MediaAssetResource[];
}

export interface FormSubmissionResource {
  id: string;
  page_slug: string;
  block_instance_id: string;
  form_kind: InquiryFormKind;
  payload: { name?: string; email?: string; phone?: string; subject?: string; message?: string };
  email: string;
  subject: string;
  status: 'unread' | 'read' | 'archived';
  mail_status: 'pending' | 'sent' | 'failed';
  mail_error: string | null;
  mail_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface FormSubmissionListResource { items: FormSubmissionResource[]; }

export interface SiteShellResource {
  locale: string;
  lock_version: number;
  brand_name: string;
  logo_url: string;
  home_url: string;
  header_variant: 'solid' | 'transparent';
  sticky: boolean;
  navigation: SiteShellLink[];
  cta: SiteShellLink | null;
  footer_text: string;
  show_footer_navigation: boolean;
  mobile_menu_style?: 'dropdown' | 'drawer-left' | 'drawer-right' | 'sheet-bottom';
  updated_at: string | null;
}

export interface SitePartResource {
  set_id: string | null;
  title: string;
  document: SitePartDocument;
  lock_version: number;
  revision: number;
  active_revision: number | null;
  status: 'draft' | 'published_with_changes' | 'published';
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
}

export interface SitePartSetPartSummary {
  site_part_id: string;
  revision: number;
  active_revision: number | null;
  status: 'draft' | 'published_with_changes' | 'published';
  updated_at: string | null;
}

export interface SitePartSetResource {
  id: string;
  title: string;
  locale: string;
  is_active: boolean;
  is_ready: boolean;
  header: SitePartSetPartSummary;
  footer: SitePartSetPartSummary;
  created_at: string | null;
  updated_at: string | null;
}

export interface SitePartSetEditorResource {
  set: SitePartSetResource;
  header: SitePartResource;
  footer: SitePartResource;
}

export interface SitePartRevisionResource {
  revision: number;
  title: string;
  document: SitePartDocument;
  author_id: number | null;
  created_at: string;
}

export interface PreviewResource {
  preview_url: string;
  expires_at: string;
}

export interface PublicationPreparation {
  publication_token: string;
  artifact_sha256: string;
  warnings: string[];
}

export interface PublicationCommit {
  public_url: string;
  artifact_sha256: string;
  published_at: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}
