# Block Library V2 benchmark and acceptance

## 결론

기존 45개 블록·55개 프리셋은 기능 분류는 갖췄지만, 38개 블록이 단일 프리셋이어서 실사용자가 체감하는 레이아웃 다양성이 부족했다. V2는 블록 타입을 무작정 늘리지 않고 사용 빈도가 높은 12개 블록에 52개의 구조형 레이아웃을 제공하며, 전체 프리셋을 95개로 확장한다.

색상·문구만 바꾼 항목은 구조형 프리셋으로 계산하지 않는다. 그리드 비율, 정보 순서, 미디어 위치, 강조 크기, 스크롤 방향 가운데 하나 이상이 실제로 달라져야 한다.

## 공식 제품 벤치마크

| 제품 | 공식 자료에서 확인한 범위 | V2에 반영한 원칙 |
|---|---:|---|
| [Tailwind Plus Marketing](https://tailwindcss.com/plus/ui-blocks/marketing) | 16개 마케팅 분류, 126개 섹션 | Hero·Feature·CTA·Pricing·Testimonial·Content 안에서 구조 변형을 별도 선택지로 제공 |
| [Elementor Website Templates](https://elementor.com/resources/website-templates/) | 300개 이상 웹사이트 템플릿 | 샘플 문구뿐 아니라 실제 이미지와 완성된 페이지 흐름을 함께 제공 |
| [Avada Prebuilt Websites](https://avada.com/prebuilt-websites/) | 113개 프리빌트 웹사이트 | 업종별 페이지 킷이 서로 다른 레이아웃 언어를 갖도록 구성 |
| [BeTheme](https://www.muffingroup.com/betheme/features/) | 700개 이상 프리빌트 웹사이트, 200개 이상 요소 | 타입 수와 프리셋 수를 구분하고 조합 가능한 구조 변형을 우선 |
| [Webflow SaaS templates](https://webflow.com/templates/search/saas) | 다수의 현재 판매 템플릿 | 첫 화면, 사회적 증거, 상세 설명, 마지막 행동의 완성 흐름을 검증 |

외부 제품의 코드와 디자인을 복제하지 않는다. 공개된 분류, 정보 위계와 반복되는 레이아웃 패턴만 비교해 자체 문서 계약과 CSS로 구현한다.

## V2 구조형 프리셋

| 블록 | 레이아웃 |
|---|---|
| Hero | product, poster, backdrop, editorial, device |
| Split Hero | balanced, screenshot, overlap, offset |
| Features | grid, bento, editorial, panel, list |
| CTA | split, centered, banner, panel |
| Logo Cloud | strip, grid, panel |
| Stats | grid, strip, split, editorial |
| Pricing | cards, featured, compact, editorial |
| Team | grid, portraits, editorial, featured |
| Gallery | grid, bento, masonry, filmstrip |
| Testimonials | grid, spotlight, split, wall, quote-hero |
| Article List | list, grid, featured, magazine, editorial |
| Card Grid | grid, bento, rail, editorial, numbered |

합계는 12개 핵심 블록, 52개 구조형 레이아웃, 전체 95개 프리셋이다.

## 샘플 콘텐츠와 썸네일 기준

- Hero, Split Hero, Team, Gallery, Testimonials, Article List 프리셋에는 모듈이 배포하는 실제 샘플 이미지를 기본 등록한다.
- 이미지 URL은 공식 Store preview 자산을 사용하므로 외부 네트워크 없이 로컬과 고객 서버에서 동일하게 보인다.
- 썸네일은 편집기용 도형이 아니라 `HtmlDocumentCompiler`의 실제 HTML과 공개 Viewer CSS로 생성한다.
- 960×600 공개 렌더러 영역을 320×200으로 축소해, 긴 블록 전체를 억지로 맞추며 내용이 작아지는 문제를 방지한다.
- 모든 45개 블록과 95개 프리셋, 총 140개 썸네일을 렌더러 기반으로 생성하고 해시를 manifest에 기록한다.

## 페이지 킷 반영

5개 페이지 킷은 같은 블록을 사용하더라도 업종별로 다른 구조를 사용한다.

- Company Launch: screenshot Hero, bento Features, editorial Stats, portraits Team, testimonial wall, panel CTA
- Editorial Community: offset Hero, magazine Article List, banner CTA
- Event Launch: overlap Hero, stat strip, featured Team, logo grid
- Local Business: balanced Hero, feature panel, split Testimonials
- Service Conversion: screenshot Hero, quote-hero Testimonials

## 수용 기준

1. 과거 문서는 `layout`이 없어도 기존 기본 구조로 컴파일된다.
2. 새 레이아웃은 Schema, TypeScript editor adapter, PHP compiler, 공개 CSS와 편집 CSS에서 동일한 enum을 사용한다.
3. 레이아웃을 변경하고 저장한 뒤 canonical document 왕복 변환에서 값이 유지된다.
4. 모든 프리셋은 컴파일되고 140개 썸네일이 생성된다.
5. PC·태블릿·모바일에서 가로 넘침이 없고, 페이지 킷 15개 스크린샷이 생성된다.
6. 제품 버전은 통합 단계에서 SemVer로 올리고 `CHANGELOG.md` Unreleased에 변경을 기록한다.
