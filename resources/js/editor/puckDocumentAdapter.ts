import type { PageBuilderBlock, PageBuilderDocument, ScalarToken } from '../documents/types';
import { isExternalEditorItem } from '../blocks/externalEditorData';
import { validateLayoutDocument } from '../documents/layoutPolicy';
import type { PuckEditorData } from './puckEditorTypes';
import { puckLayoutSlot } from './puckLayoutData';
import { blockContainerEditorProps } from './blockAppearance';
import { pageDesignToTokens, tokensToPageDesign } from './pageDesignTokens';

// Only canonical document envelopes live here. Block conversion is supplied by
// the adapter; no Puck runtime, React state, network or browser DOM is imported.
interface BlockRoundTripMetadata {
  blockVersion: number;
  hadSlots: boolean;
  hadAppearance: boolean;
  hadMotion: boolean;
  hadVisibility: boolean;
  hadResponsive: boolean;
  hadLayout: boolean;
  initialLayout: string | null;
  hadPageSize: boolean;
  hadSliderSettings: boolean;
}

export interface PuckAdapterContext {
  document: {
    schemaVersion: PageBuilderDocument['schema_version'];
    documentId: string;
    slug: string;
    mode: PageBuilderDocument['mode'];
    locale: string;
    shellMode: NonNullable<PageBuilderDocument['shell_mode']>;
    hadShellMode: boolean;
    tokens: Record<string, ScalarToken>;
    hadTokens: boolean;
    seo?: PageBuilderDocument['seo'];
  };
  blocks: Record<string, BlockRoundTripMetadata>;
}

export interface PuckEditorSession {
  data: PuckEditorData;
  context: PuckAdapterContext;
}

function cloneTokens(tokens: Record<string, ScalarToken> | undefined): Record<string, ScalarToken> {
  return tokens ? { ...tokens } : {};
}

export function canonicalDocumentToPuck(document: PageBuilderDocument, convertBlock: (block: PageBuilderBlock) => PuckEditorData['content'][number]): PuckEditorSession {
  const metadata: Record<string, BlockRoundTripMetadata> = {};
  const convertedBlocks = document.blocks.map(convertBlock);
  const collectMetadata = (block: PageBuilderBlock, initialPuckBlock: PuckEditorData['content'][number]): void => {
    const initialLayoutValue = 'layout' in initialPuckBlock.props ? initialPuckBlock.props.layout : undefined;
    metadata[block.instance_id.toLowerCase()] = {
      blockVersion: block.block_version,
      hadSlots: Object.prototype.hasOwnProperty.call(block, 'slots'),
      hadAppearance: Object.prototype.hasOwnProperty.call(block.props, 'appearance'),
      hadMotion: Object.prototype.hasOwnProperty.call(block, 'motion'),
      hadVisibility: Object.prototype.hasOwnProperty.call(block, 'visibility'),
      hadResponsive: Object.prototype.hasOwnProperty.call(block, 'responsive'),
      hadLayout: Object.prototype.hasOwnProperty.call(block.props, 'layout'),
      initialLayout: typeof initialLayoutValue === 'string' ? initialLayoutValue : null,
      hadPageSize: Object.prototype.hasOwnProperty.call(block.props, 'pageSize'),
      hadSliderSettings: Object.prototype.hasOwnProperty.call(block.props, 'autoplay')
        || Object.prototype.hasOwnProperty.call(block.props, 'interval')
        || Object.prototype.hasOwnProperty.call(block.props, 'loop'),
    };
    for (const [slotName, children] of Object.entries(block.slots ?? {})) {
      const convertedChildren = puckLayoutSlot(initialPuckBlock, slotName);
      if (!convertedChildren) continue;
      children.forEach((child, index) => {
        const convertedChild = convertedChildren[index];
        if (convertedChild) collectMetadata(child, convertedChild);
      });
    }
  };
  for (const [index, block] of document.blocks.entries()) {
    collectMetadata(block, convertedBlocks[index]);
  }

  return {
    data: {
      root: { props: tokensToPageDesign(document.tokens) },
      content: document.blocks.map((block, index) => {
        const puckBlock = convertedBlocks[index];
        if (isExternalEditorItem(puckBlock)) return puckBlock;
        return Object.assign({}, puckBlock, {
          props: Object.assign({}, puckBlock.props, blockContainerEditorProps(block.props.appearance), {
            __g7pbVisibilityAudience: block.visibility?.audience ?? 'all',
          }),
        });
      }),
    },
    context: {
      document: {
        schemaVersion: document.schema_version,
        documentId: document.document_id,
        slug: document.slug,
        mode: document.mode,
        locale: document.locale,
        shellMode: document.shell_mode ?? 'template',
        hadShellMode: Object.prototype.hasOwnProperty.call(document, 'shell_mode'),
        tokens: cloneTokens(document.tokens),
        hadTokens: Object.prototype.hasOwnProperty.call(document, 'tokens'),
        ...(document.seo ? { seo: { ...document.seo } } : {}),
      },
      blocks: metadata,
    },
  };
}

export function puckDocumentToCanonical(
  data: PuckEditorData,
  context: PuckAdapterContext,
  convertBlock: (block: PuckEditorData['content'][number], context: PuckAdapterContext) => PageBuilderBlock,
): PageBuilderDocument {
  const document: PageBuilderDocument = {
    schema_version: context.document.schemaVersion,
    document_id: context.document.documentId,
    slug: context.document.slug,
    mode: context.document.mode,
    locale: context.document.locale,
    blocks: data.content.map((block) => convertBlock(block, context)),
  };

  if (context.document.hadShellMode || context.document.shellMode !== 'template') {
    document.shell_mode = context.document.shellMode;
  }

  if (context.document.seo) document.seo = { ...context.document.seo };

  const tokens = pageDesignToTokens(data.root.props, context.document.tokens);
  if (context.document.hadTokens || Object.keys(tokens).length > 0) {
    document.tokens = tokens;
  }

  if (document.schema_version === 'g7-page-builder/v2') {
    validateLayoutDocument(document);
  }

  return document;
}
