export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['dist/**', 'output/**'],
  rules: {
    'at-rule-empty-line-before': null,
    'color-hex-length': null,
    'comment-empty-line-before': null,
    'custom-property-empty-line-before': null,
    'custom-property-pattern': '^(?:g7pb|puck)-[a-z0-9-]+$',
    'declaration-block-single-line-max-declarations': null,
    'declaration-empty-line-before': null,
    'declaration-property-value-no-unknown': null,
    'media-feature-range-notation': null,
    'no-descending-specificity': null,
    'no-duplicate-selectors': null,
    'rule-empty-line-before': null,
    'selector-class-pattern': [
      '^(?:(?:g7pb|Puck|puck)[A-Za-z0-9_-]*|is-[a-z0-9_-]+|sr-only)$',
      { message: 'Classes must use the g7pb prefix; Puck vendor and explicit state/helper classes are exceptions.' },
    ],
    'selector-not-notation': null,
    'value-keyword-case': null,
  },
};
