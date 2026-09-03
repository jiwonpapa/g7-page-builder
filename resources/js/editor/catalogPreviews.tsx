import type { HeroSlideItem } from '../documents/builtinBlockContracts';
import React, { useState } from 'react';
import { asRecord, asString, DEFAULT_HERO_SLIDER, safeUrl, normalizeLogos, normalizeStats, normalizePricingEditor, normalizeMembers, normalizeImages, normalizeBars } from './catalogData';
import type { HeroSplitEditorProps, HeroSliderEditorProps, LogoCloudEditorProps, StatsEditorProps, PricingEditorProps, TeamEditorProps, GalleryEditorProps, BarChartEditorProps, G7RecentPostsEditorProps, G7ProductGridEditorProps, InquiryFormEditorProps, MapDirectionsEditorProps } from './catalogEditorTypes';
import { CatalogBlockFrame as BlockFrame } from './CatalogBlockFrame';
import { RichTextCanvasField } from './richTextEditing';
import { CatalogIcon } from './catalogIcon';
import type { CatalogIconName } from './catalogIcon';

type HeroSlidePreviewItem = Omit<HeroSlideItem, 'eyebrow' | 'title' | 'body' | 'buttonLabel'> & {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  body: React.ReactNode;
  buttonLabel: React.ReactNode;
};

function inlineContent(value: unknown, fallback: string): React.ReactNode {
  return React.isValidElement(value) || typeof value === 'string' ? value : fallback;
}

function inlineArrayContent(value: unknown, index: number, key: string, fallback: string): React.ReactNode {
  const item = Array.isArray(value) ? asRecord(value[index]) : {};
  return inlineContent(item[key], fallback);
}

function inlineArrayText(value: unknown, index: number, key: string, fallback = ''): string {
  const item = Array.isArray(value) ? asRecord(value[index]) : {};
  const candidate = item[key];
  if (React.isValidElement(candidate)) {
    const elementValue = (candidate.props as { value?: unknown }).value;
    return typeof elementValue === 'string' ? elementValue : fallback;
  }
  return asString(candidate, fallback);
}

function inlineNestedArrayContent(
  value: unknown,
  outerIndex: number,
  collection: string,
  innerIndex: number,
  key: string,
  fallback: string,
): React.ReactNode {
  const outer = Array.isArray(value) ? asRecord(value[outerIndex]) : {};
  const nested = Array.isArray(outer[collection]) ? outer[collection] as unknown[] : [];
  return inlineContent(asRecord(nested[innerIndex])[key], fallback);
}

function previewHeroSlides(value: unknown): HeroSlidePreviewItem[] {
  const source = Array.isArray(value) ? value : DEFAULT_HERO_SLIDER.slides;

  return source.slice(0, 5).map((raw, index) => {
    const item = asRecord(raw);
    const fallback = DEFAULT_HERO_SLIDER.slides[index] ?? DEFAULT_HERO_SLIDER.slides[0];

    return {
      eyebrow: inlineContent(item.eyebrow, fallback.eyebrow),
      title: inlineContent(item.title, fallback.title),
      body: inlineContent(item.body, fallback.body),
      buttonLabel: inlineContent(item.buttonLabel, fallback.buttonLabel),
      buttonUrl: asString(item.buttonUrl),
      imageSrc: asString(item.imageSrc),
      imageAlt: asString(item.imageAlt),
    };
  });
}

function ImageOrPlaceholder({ src, alt, label }: { src: string; alt: string; label: string }): React.ReactElement {
  const safe = safeUrl(src);
  return safe
    ? <img src={safe} alt={alt} />
    : <span className="g7pb-preview-media-placeholder" aria-label={`${label} 이미지 자리`}>{label}</span>;
}

function surfaceClass(surface: string, spacing: string, textScale = 'balanced', textAlign = 'left'): string {
  return `g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`;
}

export function HeroSplitPreview(props: Omit<HeroSplitEditorProps, 'body'> & { id: string; body: React.ReactNode }): React.ReactElement {
  return (
    <BlockFrame id={props.id} type="hero-split" motion={props.motion} elementStyles={props.elementStyles}>
      <div className={`g7pb-preview-hero-split g7pb-preview-hero-split--${props.mediaPosition} g7pb-preview-hero-split--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}>
        <div className="g7pb-preview-hero-split__copy"><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h1" className="g7pb-preview-richtext" fieldPath="title">{props.title}</RichTextCanvasField><RichTextCanvasField fieldPath="body">{props.body}</RichTextCanvasField>{props.primaryLabel && <a data-g7pb-inline-field="primaryLabel" href={safeUrl(props.primaryUrl) ?? '#'} onClick={(event) => event.preventDefault()}>{props.primaryLabel}</a>}</div>
        <figure data-g7pb-media-field="imageSrc"><ImageOrPlaceholder src={props.imageSrc} alt={props.imageAlt} label="대표" /></figure>
      </div>
    </BlockFrame>
  );
}

export function HeroSliderPreview(props: HeroSliderEditorProps & { id: string }): React.ReactElement {
  const slides = previewHeroSlides(props.slides);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeIndex = Math.min(selectedIndex, Math.max(0, slides.length - 1));

  const navigate = (target: 'previous' | 'next' | number): void => {
    if (slides.length === 0) return;
    if (typeof target === 'number') {
      setSelectedIndex(Math.min(Math.max(target, 0), slides.length - 1));
      return;
    }

    setSelectedIndex((current) => {
      const visibleIndex = Math.min(current, slides.length - 1);
      const next = target === 'previous' ? visibleIndex - 1 : visibleIndex + 1;
      if (props.loop === 'yes') {
        return (next + slides.length) % slides.length;
      }
      return Math.min(Math.max(next, 0), slides.length - 1);
    });
  };

  return (
    <BlockFrame id={props.id} type="hero-slider" motion={props.motion} elementStyles={props.elementStyles}>
      <div className={`g7pb-preview-hero-slider ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}>
        <div className="g7pb-preview-hero-slider__viewport">
          <div className="g7pb-preview-hero-slider__track">
            {slides.map((slide, index) => <article key={index} data-slide-index={index} style={{ order: index === activeIndex ? -1 : index }}>
              <div className="g7pb-preview-hero-slider__copy">
                <small data-g7pb-inline-field={`slides.${index}.eyebrow`}>{slide.eyebrow}</small>
                <RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath={`slides.${index}.title`}>{slide.title}</RichTextCanvasField>
                <RichTextCanvasField className="g7pb-preview-richtext g7pb-preview-hero-slider__body" fieldPath={`slides.${index}.body`}>{slide.body}</RichTextCanvasField>
                {inlineArrayText(props.slides, index, 'buttonLabel', slide.buttonLabel as string) && <a className="g7pb-preview-hero-slider__cta" data-g7pb-inline-field={`slides.${index}.buttonLabel`} href={safeUrl(slide.buttonUrl) ?? '#'} onClick={(event) => event.preventDefault()}>{slide.buttonLabel}</a>}
              </div>
              <figure data-g7pb-media-field={`slides.${index}.imageSrc`}><ImageOrPlaceholder src={slide.imageSrc} alt={slide.imageAlt} label={`슬라이드 ${index + 1}`} /></figure>
            </article>)}
          </div>
        </div>
        <div
          className="g7pb-preview-hero-slider__controls"
          data-puck-overlay-portal="true"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" aria-label="이전 슬라이드" data-testid="page-builder-slider-previous" onClick={() => navigate('previous')}>←</button>
          <div className="g7pb-preview-hero-slider__dots" aria-label="편집할 슬라이드">
            {slides.map((_, index) => <button type="button" aria-label={`${index + 1}번 슬라이드 편집`} aria-pressed={activeIndex === index} className={activeIndex === index ? 'is-active' : ''} data-testid={`page-builder-slider-slide-${index}`} key={index} onClick={() => navigate(index)} />)}
          </div>
          <span>{activeIndex + 1} / {slides.length}</span>
          <button type="button" aria-label="다음 슬라이드" data-testid="page-builder-slider-next" onClick={() => navigate('next')}>→</button>
        </div>
        {props.autoplay === 'yes' && <p className="g7pb-preview-hero-slider__editing-note">편집 중 자동 재생은 멈추며 발행 화면에서만 적용됩니다.</p>}
      </div>
    </BlockFrame>
  );
}

export function LogoCloudPreview(props: LogoCloudEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="logo-cloud" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-logo-cloud g7pb-preview-logo-cloud--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><div>{normalizeLogos(props.logos).map((logo, index) => <span key={`${logo.name}-${index}`} data-g7pb-media-field={`logos.${index}.imageSrc`}>{safeUrl(logo.imageSrc) ? <img src={safeUrl(logo.imageSrc) ?? ''} alt={logo.imageAlt} /> : <b data-g7pb-inline-field={`logos.${index}.name`}>{inlineArrayContent(props.logos, index, 'name', logo.name)}</b>}</span>)}</div></div></BlockFrame>;
}

export function StatsPreview(props: StatsEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="stats" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-stats g7pb-preview-stats--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div>{normalizeStats(props.items).map((item, index) => <article key={`${item.label}-${index}`}><i aria-hidden="true"><CatalogIcon name={item.icon as CatalogIconName} size={28} /></i><strong data-g7pb-inline-field={`items.${index}.value`}>{inlineArrayContent(props.items, index, 'value', item.value)}</strong><RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`items.${index}.label`}>{inlineArrayContent(props.items, index, 'label', item.label)}</RichTextCanvasField><RichTextCanvasField fieldPath={`items.${index}.detail`}>{inlineArrayContent(props.items, index, 'detail', item.detail)}</RichTextCanvasField></article>)}</div></div></BlockFrame>;
}

export function PricingPreview(props: PricingEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="pricing" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-pricing g7pb-preview-pricing--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div>{normalizePricingEditor(props.plans).map((plan, index) => <article className={plan.featured === 'yes' ? 'is-featured' : ''} key={`${plan.name}-${index}`}><RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`plans.${index}.name`}>{inlineArrayContent(props.plans, index, 'name', plan.name)}</RichTextCanvasField><p><strong data-g7pb-inline-field={`plans.${index}.price`}>{inlineArrayContent(props.plans, index, 'price', plan.price)}</strong><span data-g7pb-inline-field={`plans.${index}.period`}>{inlineArrayContent(props.plans, index, 'period', plan.period)}</span></p><RichTextCanvasField fieldPath={`plans.${index}.description`}>{inlineArrayContent(props.plans, index, 'description', plan.description)}</RichTextCanvasField><ul>{plan.features.map((feature, featureIndex) => <li key={featureIndex}><RichTextCanvasField as="span" className="g7pb-preview-richtext" fieldPath={`plans.${index}.features.${featureIndex}`}>{inlineNestedArrayContent(props.plans, index, 'features', featureIndex, 'text', feature.text)}</RichTextCanvasField></li>)}</ul><b data-g7pb-inline-field={`plans.${index}.buttonLabel`}>{inlineArrayContent(props.plans, index, 'buttonLabel', plan.buttonLabel)}</b></article>)}</div></div></BlockFrame>;
}

export function TeamPreview(props: TeamEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="team" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-team g7pb-preview-team--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div>{normalizeMembers(props.members).map((member, index) => <article key={`${member.name}-${index}`}><figure data-g7pb-media-field={`members.${index}.imageSrc`}><ImageOrPlaceholder src={member.imageSrc} alt={member.imageAlt} label={member.name.slice(0, 1)} /></figure><h3 data-g7pb-inline-field={`members.${index}.name`}>{inlineArrayContent(props.members, index, 'name', member.name)}</h3><strong data-g7pb-inline-field={`members.${index}.role`}>{inlineArrayContent(props.members, index, 'role', member.role)}</strong><RichTextCanvasField fieldPath={`members.${index}.bio`}>{inlineArrayContent(props.members, index, 'bio', member.bio)}</RichTextCanvasField></article>)}</div></div></BlockFrame>;
}

export function GalleryPreview(props: GalleryEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="gallery" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-gallery g7pb-preview-gallery--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div className={`g7pb-preview-gallery__grid g7pb-preview-gallery__grid--${props.columns}`}>{normalizeImages(props.images).map((image, index) => <figure key={`${image.caption}-${index}`}><span data-g7pb-media-field={`images.${index}.src`}><ImageOrPlaceholder src={image.src} alt={image.alt} label={`이미지 ${index + 1}`} /></span><figcaption data-g7pb-inline-field={`images.${index}.caption`}>{inlineArrayContent(props.images, index, 'caption', image.caption)}</figcaption></figure>)}</div></div></BlockFrame>;
}

export function BarChartPreview(props: BarChartEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="bar-chart" motion={props.motion} elementStyles={props.elementStyles}><figure className={`g7pb-preview-bar-chart ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><figcaption><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><RichTextCanvasField fieldPath="description">{props.description}</RichTextCanvasField></figcaption><div>{normalizeBars(props.items).map((item, index) => <label key={`${item.label}-${index}`}><span><span data-g7pb-inline-field={`items.${index}.label`}>{inlineArrayContent(props.items, index, 'label', item.label)}</span><b>{item.value}<span data-g7pb-inline-field="unit">{props.unit}</span></b></span><progress max={100} value={item.value} data-tone={item.tone}>{item.value}</progress></label>)}</div></figure></BlockFrame>;
}

export function G7RecentPostsPreview(props: G7RecentPostsEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="g7-recent-posts" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-g7-data ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><em>G7 게시판 · {props.source === 'recent' ? '최신순' : '인기순'} · {props.limit}개</em></header><div className="g7pb-preview-post-list">{['페이지 제작 소식을 전합니다', '새로운 기능 업데이트 안내', '자주 묻는 질문을 확인하세요'].map((title, index) => <article key={title}><span>{index + 1}</span><div><strong>{title}</strong><small>게시판 이름 · 방금 전</small></div><b>→</b></article>)}</div><p className="g7pb-preview-data-note">실제 공개 게시글은 미리보기·발행 화면에서 G7 공개 API로 불러옵니다.</p></div></BlockFrame>;
}

export function G7ProductGridPreview(props: G7ProductGridEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="g7-product-grid" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-g7-data ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><em>G7 쇼핑몰 · {props.source === 'new' ? '신상품' : props.source === 'popular' ? '인기 상품' : '최신순'} · {props.limit}개</em></header><div className={`g7pb-preview-product-grid g7pb-preview-product-grid--${props.columns}`}>{['상품 A', '상품 B', '상품 C', '상품 D'].slice(0, Number(props.columns)).map((name, index) => <article key={name}><span aria-hidden="true">상품 이미지</span><strong>{name}</strong><small>{(29000 + index * 10000).toLocaleString()}원</small></article>)}</div><p className="g7pb-preview-data-note">실제 상품은 미리보기·발행 화면에서 G7 공개 API로 불러옵니다.</p></div></BlockFrame>;
}

export function InquiryFormPreview(props: InquiryFormEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="inquiry-form" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-inquiry ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}>
    <div><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><RichTextCanvasField fieldPath="description">{props.description}</RichTextCanvasField></div>
    <form onSubmit={(event) => event.preventDefault()} aria-label="문의 폼 미리보기"><label><span>이름</span><input readOnly placeholder="홍길동" /></label><label><span>이메일</span><input readOnly placeholder="hello@example.com" /></label>{props.showPhone ? <label><span>전화번호</span><input readOnly placeholder="010-0000-0000" /></label> : null}{props.showSubject ? <label><span>문의 제목</span><input readOnly placeholder="문의 제목" /></label> : null}<label className="is-wide"><span>문의 내용</span><textarea readOnly rows={5} placeholder="문의 내용을 입력하세요." /></label><label className="is-consent"><input type="checkbox" readOnly /><span data-g7pb-inline-field="privacyLabel">{props.privacyLabel}</span></label><button type="button" data-g7pb-inline-field="submitLabel">{props.submitLabel}</button></form>
  </div></BlockFrame>;
}

export function MapDirectionsPreview(props: MapDirectionsEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="map-directions" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-map ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}>
    <div><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><RichTextCanvasField fieldPath="description">{props.description}</RichTextCanvasField><address><strong data-g7pb-inline-field="address">{props.address}</strong><span data-g7pb-inline-field="phone">{props.phone}</span><span data-g7pb-inline-field="hours">{props.hours}</span><span data-g7pb-inline-field="parking">{props.parking}</span><b data-g7pb-inline-field="directionsLabel">{props.directionsLabel} →</b></address></div>
    <figure aria-label="지도 미리보기" data-g7pb-media-field={props.provider === 'image' ? 'mapImageSrc' : undefined}>
      {props.provider === 'image'
        ? <ImageOrPlaceholder src={props.mapImageSrc} alt={props.mapImageAlt} label="지도 이미지 등록" />
        : <><span className="g7pb-preview-map__grid" /><i aria-hidden="true">●</i><figcaption>{props.provider === 'none' ? '지도 숨김' : props.provider === 'google' ? 'Google 지도' : 'OpenStreetMap'} · {props.latitude.toFixed(4)}, {props.longitude.toFixed(4)}</figcaption></>}
    </figure>
  </div></BlockFrame>;
}
