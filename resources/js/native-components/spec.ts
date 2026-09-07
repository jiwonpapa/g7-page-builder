/** Template companion fragments: merge these namespaced keys explicitly; never replace another component's capability. */
export const nativeComponentNames = ['PageBuilderSlider'];
export const nativeEditorSpec = {
  componentCapabilities: {
    PageBuilderSlider: {
      propControls: ['g7pb:slider-autoplay', 'g7pb:slider-interval'], styleControls: [],
      nodeEditor: { kind: 'array', params: { arrayProp: 'slides', itemLabel: '슬라이드',
        newItem: { id: '', src: '', alt: '', caption: '새 슬라이드' },
        fields: [{ key: 'src', widget: 'image', label: '이미지' }, { key: 'alt', widget: 'text', label: '대체 텍스트' },
          { key: 'caption', widget: 'text', label: '설명' }] } },
    },
  },
  controls: {
    'g7pb:slider-autoplay': { label: '자동 재생', widget: 'segmented', apply: { type: 'propValue', propKey: 'autoplay' },
      options: [{ label: '켜기', value: true }, { label: '끄기', value: false }] },
    'g7pb:slider-interval': { label: '재생 간격', widget: 'segmented', apply: { type: 'propValue', propKey: 'interval' },
      options: [{ label: '1초', value: 1000 }, { label: '3초', value: 3000 }, { label: '5초', value: 5000 }] },
  },
  componentPalette: { entries: { PageBuilderSlider: { label: '슬라이더', category: 'composite',
    defaultNode: { type: 'composite', name: 'PageBuilderSlider', props: { slides: [], autoplay: false, interval: 5000 } } } } },
};
export const nativeComponentManifest = { components: { composite: [{ name: 'PageBuilderSlider', type: 'composite',
  path: 'page-builder-native-components', props: { slides: { type: 'array', required: false },
    autoplay: { type: 'boolean', required: false }, interval: { type: 'number', required: false } } }] } };
