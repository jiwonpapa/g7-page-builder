import React from 'react';
import type { ContactEditorProps, CtaEditorProps, FeaturesEditorProps, HeroEditorProps } from './puckEditorTypes';
import type { BlockMotion, ElementAppearanceMap } from '../documents/types';
import { idToUuid, isSplitHeroLayout, normalizeFeatureItems, normalizeTheme } from './puckBlockCodec';
import { motionPreviewAttributes } from './blockMotion';
import {
  CanvasCurrentElementStylesContext,
  decorateCanvasElementStyles,
  notifyCanvasElementSelection,
  useCanvasBlockAppearanceClass,
  useCanvasElementStyles,
} from './canvasEditingContract';
import { canvasTextValue } from './foundationCatalogBlocks';
import { RichTextCanvasField } from './richTextEditing';
import { CatalogIcon, type CatalogIconName } from './catalogIcon';
import { EditorViewportPolicyContext } from './puckEditorContexts';
import { inlineArrayContent, safeEmailLink, safeImage, safeLink, safePhoneLink } from './previewContent';

function BlockFrame({
  id,
  type,
  motion,
  elementStyles,
  children,
}: {
  id: string;
  type: string;
  motion: BlockMotion;
  elementStyles?: ElementAppearanceMap;
  children: React.ReactNode;
}): React.ReactElement {
  const resolvedElementStyles = useCanvasElementStyles(id, elementStyles);
  const containerClassName = useCanvasBlockAppearanceClass(id);
  return (
    <section
      className={`g7pb-preview-block ${containerClassName}`.trim()}
      data-testid="page-builder-block"
      data-block-id={idToUuid(id)}
      data-block-type={type}
      onPointerDownCapture={(event) => notifyCanvasElementSelection(event, idToUuid(id), type)}
      {...motionPreviewAttributes(motion)}
    >
      <CanvasCurrentElementStylesContext.Provider value={resolvedElementStyles}>
        {decorateCanvasElementStyles(children, resolvedElementStyles)}
      </CanvasCurrentElementStylesContext.Provider>
    </section>
  );
}

export function HeroPreview({
  id,
  eyebrow,
  title,
  body,
  primaryLabel,
  primaryUrl,
  imageSrc,
  imageAlt,
  alignment,
  mediaPosition,
  layout,
  surface,
  spacing,
  textScale = 'balanced',
  textAlign = 'left',
  elementStyles,
  motion,
}: Omit<HeroEditorProps, 'body' | 'title'> & { id: string; body: React.ReactNode; title: React.ReactNode }): React.ReactElement {
  const image = safeImage(imageSrc);

  if (isSplitHeroLayout(layout)) {
    return (
      <BlockFrame id={id} type="hero" motion={motion} elementStyles={elementStyles}>
        <div className={`g7pb-preview-hero-split g7pb-preview-hero-split--${mediaPosition} g7pb-preview-hero-split--layout-${layout} g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`}>
          <div className="g7pb-preview-hero-split__copy">
            {canvasTextValue(eyebrow, 'plain') && <small data-g7pb-inline-field="eyebrow">{eyebrow}</small>}
            <RichTextCanvasField as="h1" className="g7pb-preview-richtext" fieldPath="title">{title}</RichTextCanvasField>
            <RichTextCanvasField fieldPath="body">{body}</RichTextCanvasField>
            {canvasTextValue(primaryLabel, 'plain') && <a data-g7pb-inline-field="primaryLabel" href={safeLink(primaryUrl)} onClick={(event) => event.preventDefault()}>{primaryLabel}</a>}
          </div>
          <figure data-g7pb-media-field="imageSrc">
            {image
              ? <img src={image} alt={imageAlt} />
              : <span className="g7pb-preview-media-placeholder" role="img" aria-label="대표 이미지를 선택하세요">대표 이미지를 선택하세요</span>}
          </figure>
        </div>
      </BlockFrame>
    );
  }

  return (
    <BlockFrame id={id} type="hero" motion={motion} elementStyles={elementStyles}>
      <div className={`g7pb-preview-hero g7pb-preview-hero--${alignment} g7pb-preview-hero--layout-${layout} g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`}>
        {canvasTextValue(eyebrow, 'plain') && <p className="g7pb-preview-eyebrow" data-g7pb-inline-field="eyebrow">{eyebrow}</p>}
        <RichTextCanvasField as="h1" className="g7pb-preview-richtext g7pb-preview-hero__title" fieldPath="title">{title}</RichTextCanvasField>
        <RichTextCanvasField fieldPath="body">{body}</RichTextCanvasField>
        {canvasTextValue(primaryLabel, 'plain') && (
          <a className="g7pb-preview-cta" href={safeLink(primaryUrl)} onClick={(event) => event.preventDefault()}>
            <span data-g7pb-inline-field="primaryLabel">{primaryLabel}</span>
          </a>
        )}
        <figure className="g7pb-preview-hero__media" data-g7pb-media-field="imageSrc">
          {image
            ? <img src={image} alt={imageAlt} />
            : <span className="g7pb-preview-media-placeholder" role="img" aria-label="대표 이미지를 선택하세요">대표 이미지를 선택하세요</span>}
        </figure>
      </div>
    </BlockFrame>
  );
}

export function FeaturesPreview({ id, title, items, layout, surface, spacing, textScale = 'balanced', textAlign = 'left', elementStyles, motion }: Omit<FeaturesEditorProps, 'title'> & { id: string; title: React.ReactNode }): React.ReactElement {
  return (
    <BlockFrame id={id} type="features" motion={motion} elementStyles={elementStyles}>
      <div className={`g7pb-preview-features g7pb-preview-features--layout-${layout} g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`}>
        <RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="title">{title}</RichTextCanvasField>
        <div className="g7pb-preview-features__grid">
          {normalizeFeatureItems(items).map((item, index) => (
            <article key={`${item.title}-${index}`}>
              <span aria-hidden="true"><CatalogIcon name={(item.icon || 'sparkles') as CatalogIconName} size={34} /></span>
              <RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`items.${index}.title`}>
                {inlineArrayContent(items, index, 'title', item.title)}
              </RichTextCanvasField>
              <RichTextCanvasField fieldPath={`items.${index}.body`}>
                {inlineArrayContent(items, index, 'body', item.body)}
              </RichTextCanvasField>
            </article>
          ))}
        </div>
      </div>
    </BlockFrame>
  );
}

export function CtaPreview({
  id,
  eyebrow,
  heading,
  body,
  primaryLabel,
  primaryUrl,
  secondaryLabel,
  secondaryUrl,
  theme,
  layout,
  surface,
  spacing,
  textScale = 'balanced',
  textAlign = 'left',
  elementStyles,
  motion,
}: Omit<CtaEditorProps, 'heading' | 'body'> & { id: string; heading: React.ReactNode; body: React.ReactNode }): React.ReactElement {
  const { canEdit } = React.useContext(EditorViewportPolicyContext);
  return (
    <BlockFrame id={id} type="cta" motion={motion} elementStyles={elementStyles}>
      <div className={`g7pb-preview-cta-split g7pb-preview-cta-split--${normalizeTheme(theme)} g7pb-preview-cta-split--layout-${layout} g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`}>
        <div className="g7pb-preview-cta-split__copy">
          {canvasTextValue(eyebrow, 'plain') && <p className="g7pb-preview-eyebrow" data-g7pb-inline-field="eyebrow">{eyebrow}</p>}
          <RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{heading}</RichTextCanvasField>
          {(canEdit || canvasTextValue(body)) && <RichTextCanvasField fieldPath="body">{body}</RichTextCanvasField>}
        </div>
        {(canvasTextValue(primaryLabel, 'plain') || canvasTextValue(secondaryLabel, 'plain')) && (
          <div className="g7pb-preview-cta-split__actions">
            {canvasTextValue(primaryLabel, 'plain') && (
              <a className="g7pb-preview-cta" href={safeLink(primaryUrl)} onClick={(event) => event.preventDefault()}>
                <span data-g7pb-inline-field="primaryLabel">{primaryLabel}</span>
              </a>
            )}
            {canvasTextValue(secondaryLabel, 'plain') && (
              <a className="g7pb-preview-cta g7pb-preview-cta--secondary" href={safeLink(secondaryUrl)} onClick={(event) => event.preventDefault()}>
                <span data-g7pb-inline-field="secondaryLabel">{secondaryLabel}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </BlockFrame>
  );
}

export function ContactPreview({
  id,
  heading,
  address,
  phone,
  email,
  ctaLabel,
  ctaUrl,
  mapLabel,
  mapUrl,
  surface,
  spacing,
  textScale = 'balanced',
  textAlign = 'left',
  elementStyles,
  motion,
}: Omit<ContactEditorProps, 'heading'> & { id: string; heading: React.ReactNode }): React.ReactElement {
  return (
    <BlockFrame id={id} type="contact" motion={motion} elementStyles={elementStyles}>
      <div className={`g7pb-preview-contact g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`}>
        <div className="g7pb-preview-contact__heading">
          <p className="g7pb-preview-eyebrow">Contact</p>
          <RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{heading}</RichTextCanvasField>
        </div>
        <address className="g7pb-preview-contact__details">
          {canvasTextValue(address, 'plain') && <p data-g7pb-inline-field="address">{address}</p>}
          {phone && (
            <a href={safePhoneLink(phone)} onClick={(event) => event.preventDefault()}><span data-g7pb-inline-field="phone">{phone}</span></a>
          )}
          {email && (
            <a href={safeEmailLink(email)} onClick={(event) => event.preventDefault()}><span data-g7pb-inline-field="email">{email}</span></a>
          )}
        </address>
        {(canvasTextValue(ctaLabel, 'plain') || canvasTextValue(mapLabel, 'plain')) && (
          <div className="g7pb-preview-contact__actions">
            {canvasTextValue(ctaLabel, 'plain') && (
              <a className="g7pb-preview-cta" href={safeLink(ctaUrl)} onClick={(event) => event.preventDefault()}>
                <span data-g7pb-inline-field="ctaLabel">{ctaLabel}</span>
              </a>
            )}
            {canvasTextValue(mapLabel, 'plain') && (
              <a className="g7pb-preview-cta g7pb-preview-cta--secondary" href={safeLink(mapUrl)} onClick={(event) => event.preventDefault()}>
                <span data-g7pb-inline-field="mapLabel">{mapLabel}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </BlockFrame>
  );
}

