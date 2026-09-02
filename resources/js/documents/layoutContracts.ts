export const LAYOUT_SECTION_BLOCK_TYPE = 'layout.section-01' as const;

export const LAYOUT_COLUMNS_BLOCK_TYPE = 'layout.columns-01' as const;

export const LAYOUT_STACK_BLOCK_TYPE = 'layout.stack-01' as const;

export interface LayoutSectionBlockProps {
  width: 'standard' | 'wide' | 'full';
  spacing: 'compact' | 'normal' | 'spacious';
}

export interface LayoutColumnsBlockProps {
  columns: 1 | 2 | 3;
  ratio: '1' | '1:1' | '1:2' | '2:1' | '1:1:1';
  gap: 'none' | 'compact' | 'normal' | 'spacious';
}

export interface LayoutStackBlockProps {
  gap: 'none' | 'compact' | 'normal' | 'spacious';
}
