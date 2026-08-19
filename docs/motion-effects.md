# Typed motion effects contract

상태: 0.3.0 implementation baseline

## 결론

동적 효과는 임의 CSS·JavaScript 편집 기능이 아니라 블록별 typed preset입니다. 문서 원본은 효과의 의미만 저장하고, PHP compiler가 안전한 `data-*` 계약으로 변환하며, 공개 viewer는 효과가 있는 페이지에만 작은 전용 runtime을 로드합니다.

## Canonical schema

```json
{
  "motion": {
    "preset": "stagger",
    "intensity": "normal",
    "trigger": "once",
    "stagger_ms": 100
  }
}
```

- `preset`: `none`, `reveal`, `stagger`, `parallax-soft`, `counter`, `chart-draw`
- `intensity`: `subtle`, `normal`, `strong`
- `trigger`: `once`, `repeat`
- `stagger_ms`: `60`, `100`, `160`
- 추가 key, CSS class, selector, script, 임의 duration·transform은 거부합니다.

## 블록별 허용표

| 블록 | 허용 효과 |
|---|---|
| Hero·Hero Split·Hero Slider | Reveal, Soft Parallax |
| Features·Logo Cloud·Pricing·Team | Reveal, Stagger |
| Gallery | Reveal, Stagger, Soft Parallax |
| Stats | Reveal, Stagger, Counter |
| Bar Chart | Reveal, Chart Draw |
| CTA·Contact | Reveal |

편집기는 허용 효과만 표시하고 PHP compiler가 같은 표를 다시 검증합니다. UI를 우회한 호환되지 않는 조합은 발행 실패이며 마지막 정상 발행본은 유지합니다.

## 공개 runtime

```text
PageBuilderDocument.motion
  -> PHP allowlist compiler
  -> data-g7pb-motion attributes
  -> viewer detects motion
  -> self-hosted page-effects.iife.js
```

- IntersectionObserver로 viewport 진입만 감지합니다.
- Reveal·Stagger·Chart Draw는 `transform`과 `opacity` 중심으로 실행합니다.
- Soft Parallax는 passive scroll listener와 requestAnimationFrame으로 CSS 변수만 갱신합니다.
- Counter는 표시 문자열의 prefix·숫자·suffix를 보존하고 원래 값을 `aria-label`로 유지합니다.
- runtime이 없거나 실패해도 CSS 기본값은 정적 콘텐츠 노출입니다.
- 공개 페이지 CSP는 `script-src 'self'`만 허용하고 inline script·eval·외부 script는 허용하지 않습니다.

## 접근성·성능 경계

- `prefers-reduced-motion: reduce`이면 runtime 효과를 설치하지 않습니다.
- scroll 위치를 강제로 바꾸거나 wheel/touch 입력을 가로채지 않습니다.
- 전역 smooth scroll, 무한 자동재생, 배경 video, 사용자가 작성한 JS는 금지합니다.
- 공개 effects bundle 목표는 minified 8KB 이하이며 0.3.0 빌드는 약 3.6KB, gzip 약 1.6KB입니다.
- 편집기 preview는 공개 runtime을 실행하지 않고 짧은 CSS 시연만 제공해 drag/drop과 필드 편집을 방해하지 않습니다.

## 검증

- JSON Schema: 허용 preset·강도·trigger·간격과 추가 key 거부
- Puck Adapter: canonical motion 왕복과 editor-only state 비유출
- PHP compiler: 결정적 data attribute와 블록 호환표 검증
- Vitest: counter parsing, no-IntersectionObserver fallback, reduced-motion
- G7 integration: self-only CSP와 unsafe-eval/inline 부재
- Playwright: 저장→preview→publish 후 effects asset·data attribute·in-view 활성화, desktop/tablet/mobile

기술 기준은 [MDN Scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)과 [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/%40media/prefers-reduced-motion)을 참고하되, CSS Scroll Timeline 단독 의존 없이 IntersectionObserver fallback을 기본으로 유지합니다.
