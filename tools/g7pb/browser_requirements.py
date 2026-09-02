"""Reviewed source-to-behavior mapping; selection is not browser acceptance.

Each catalog file selects its declared preset families. Shared rendering helpers
use representative contracts, with exhaustive output covered by PHP/unit tests;
this must never silently expand to every Page Kit and every preset.
"""
from dataclasses import dataclass, replace
from fnmatch import fnmatchcase
import json
from pathlib import Path
import re


# Manual parity overlays/selectors must not leak into integrated product proof.
BROWSER_ENVIRONMENT = tuple((key, None) for key in (
    "G7PB_PRESET_IDS", "G7PB_PAGE_KIT_IDS", "G7PB_PARITY_CANDIDATE_DIST",
    "G7PB_PARITY_CANDIDATE_PUBLIC_CSS", "G7PB_PARITY_CANDIDATE_LAYOUTS"))


@dataclass(frozen=True, order=True)
class BrowserScenario:
    spec: str
    projects: tuple[str, ...] = ("desktop",)
    titles: tuple[str, ...] = ()
    preset_prefixes: tuple[str, ...] = ()

    def arguments(self):
        argv = ["npx", "--no-install", "playwright", "test", self.spec, "--retries=0"]
        argv.extend(f"--project={project}" for project in self.projects)
        if self.titles:
            argv.extend(["--grep", "(?:" + "|".join(re.escape(title) for title in self.titles) + ")$"])
        return argv

    def environment(self, root):
        if not self.preset_prefixes:
            return BROWSER_ENVIRONMENT
        manifest = json.loads((Path(root) / "resources/block-packs/builtin-core/manifest.json").read_text())
        ids = [item["preset_id"] for item in manifest["presets"]]
        for prefix in self.preset_prefixes:
            if not any(value == prefix or value.startswith(prefix + ".") for value in ids):
                raise ValueError(f"No declared parity preset matches {prefix}")
        selected = sorted(value for value in ids if any(value == p or value.startswith(p + ".") for p in self.preset_prefixes))
        return tuple({**dict(BROWSER_ENVIRONMENT), "G7PB_PRESET_IDS": ",".join(selected)}.items())


PAGE = BrowserScenario("tests/E2E/pageBuilderLifecycle.spec.ts", titles=(
    "manages, publishes, restores, republishes, and unpublishes a page-builder document",))
NESTED = replace(PAGE, titles=(
    "edits, reloads, publishes, restores, and republishes three columns with a nested Stack",))
TEMPLATE = replace(PAGE, titles=(
    "renders a Page Builder page and temporary home inside the active G7 User Template",))
TEXT = BrowserScenario("tests/E2E/editorInteractionQuality.spec.ts", titles=(
    "keeps root, nested, block, and no-link rich text pointer editing persistent and publishable",))
CONTROLS = replace(TEXT, titles=(
    "keeps ActionBar and rich-text controls pointer-reachable in the PC editor",))
STRUCTURE_THEME = BrowserScenario("tests/E2E/editorStructureTheme.spec.ts")
DOCUMENT_BOUNDARY = BrowserScenario("tests/E2E/editorDocumentBoundary.spec.ts", titles=(
    "rejects native invalid structure without losing valid history or saving it",
    "serializes a clean preview save with later edits",))
PARITY = BrowserScenario("tests/E2E/editorLayoutParity.spec.ts", ("desktop", "tablet", "mobile"), (
    "ALL_PRESET_LAYOUT_GATE: selected built-in presets preserve editor/preview layout",), (
    "hero.service-intro", "features.core-benefits", "cta.contact", "rich-text.article-intro",
    "image-text.product-story", "notice.service-info", "card-grid.services", "tabs.service-guide",
    "gallery.project-scenes", "inquiry.general"))
PUBLIC = BrowserScenario("tests/E2E/publicQuality.spec.ts", ("desktop", "tablet", "mobile"))
SITE_PART = BrowserScenario("tests/E2E/sitePartLifecycle.spec.ts")
SITE_SHELL = BrowserScenario("tests/E2E/globalSiteShellRoutes.spec.ts")
STORE = BrowserScenario("tests/E2E/officialStore.spec.ts")
MOBILE_NAV = BrowserScenario("tests/E2E/mobileNavigationQuality.spec.ts")

# These groups follow the components declared by each catalog module. All its
# variants remain covered; unrelated Page Kits and language scenarios do not run.
CATALOG_PREFIXES = {
    "foundationCatalogBlocks.tsx": ("heading", "rich-text", "image", "buttons", "image-text", "icon-list"),
    "phase2CatalogBlocks.tsx": ("testimonials", "faq", "process", "tabs", "comparison", "articles", "video"),
    "phase3CatalogBlocks.tsx": ("logo-carousel", "testimonial-slider", "events", "downloads", "g7-archive", "g7-showcase"),
    "phase4CatalogBlocks.tsx": ("g7-post-detail", "g7-product-detail"),
    "productionCatalogBlocks.tsx": ("divider", "blockquote", "notice", "card-grid", "breadcrumbs", "anchor-menu", "social-links", "image-carousel"),
    "catalogBlocks.tsx": ("hero-split", "hero-slider", "logo-cloud", "stats", "pricing", "team", "gallery", "bar-chart", "g7-posts", "g7-products", "inquiry", "map"),
}

# Most-specific source rules win. Adding a scenario requires a real registered
# Playwright test; a missing spec/title must fail instead of claiming acceptance.
RULES = (
    # Document transactions and shared style contracts use synthetic code fixtures,
    # not preset/catalog content sweeps. Catalog modules retain their own mapping.
    (("resources/js/editor/PuckEditorAdapter.tsx",), (PAGE, TEXT, STRUCTURE_THEME, DOCUMENT_BOUNDARY)),
    (("resources/js/editor/main.tsx",), (PAGE, DOCUMENT_BOUNDARY)),
    (("resources/js/editor/PuckDocumentBoundary.tsx", "resources/js/editor/editorDocumentBoundary.ts",
      "resources/js/editor/draftPersistence.ts"), (DOCUMENT_BOUNDARY,)),
    (("resources/js/editor/layout*", "resources/js/documents/layout*"), (NESTED, STRUCTURE_THEME)),
    (("resources/js/editor/richText*", "resources/js/editor/fontSize.ts"), (TEXT,)),
    (("resources/js/editor/canvas*",), (TEXT, CONTROLS)),
    (("resources/js/editor/editorOverlaySafeZone.ts", "resources/js/editor/editorViewportPolicy.ts"), (CONTROLS,)),
    (("resources/js/editor/puckEditorSelection.ts",), (NESTED, CONTROLS, STRUCTURE_THEME)),
    (("resources/js/editor/SectionPatternControls.tsx", "resources/js/editor/EditorPortal.tsx"), (PAGE, STRUCTURE_THEME)),
    (("resources/js/editor/pageDesignTokens.ts", "src/Domain/Documents/PageDesignTokens.php", "src/Application/Compilation/DocumentThemeCompiler.php"), (STRUCTURE_THEME, PARITY)),
    (("resources/js/editor/blockAppearance.ts",), (STRUCTURE_THEME, TEXT)),
    (("resources/js/editor/responsiveBlockStyle.tsx", "src/Application/Compilation/ElementAppearanceCompiler.php"), (PARITY,)),
    (("src/Application/Compilation/RichTextSanitizer.php",), (TEXT,)),
    (("src/Application/Compilation/CompilationUrlPolicy.php",), (PAGE,)),
    (("resources/js/editor/*SitePart*", "resources/js/editor/sitePart*", "resources/js/editor/useSitePart*", "src/*/SitePart*", "src/Domain/Site/*", "src/Application/Compilation/SitePartHtmlCompiler.php"), (SITE_PART,)),
    (("resources/js/public/siteShell*", "src/Application/SiteShell*", "src/Infrastructure/Gnuboard7/*SiteShell*"), (SITE_SHELL,)),
    (("resources/js/public/mobileNavigation*",), (MOBILE_NAV,)),
    (("resources/js/public/*", "resources/css/page-effects*"), (PUBLIC,)),
    (("resources/css/page-builder-public.css", "resources/css/page-builder-theme.css"), (STRUCTURE_THEME,)),
    (("resources/js/store/*", "src/Application/Store/*", "src/Domain/Store/*", "src/Infrastructure/Store/*"), (STORE,)),
    (("resources/js/editor/puckBlockCodec.ts", "resources/js/editor/puckDocumentAdapter.ts"), (PAGE, TEXT, STRUCTURE_THEME)),
    (("resources/css/page-builder-editor*",), (CONTROLS, STRUCTURE_THEME)),
    (("resources/css/page-builder-site-part*",), (SITE_PART,)),
    (("resources/css/page-builder-core.css",), (STRUCTURE_THEME,)),
    (("resources/js/editor/*", "resources/js/documents/*", "resources/js/api/*", "resources/js/manager/*", "resources/js/blocks/*", "resources/css/page-builder-manager.css"), (PAGE,)),
    (("resources/css/*",), (PARITY, PUBLIC)),
    (("src/Application/Compilation/*",), (PAGE, PARITY)),
    (("src/Domain/Documents/*", "src/Domain/Publishing/*", "src/Domain/Patterns/*", "src/Application/PageBuilderService.php", "src/Application/Patterns/*", "src/Infrastructure/Gnuboard7/*PageBuilder*", "src/Infrastructure/Gnuboard7/*Document*", "src/Infrastructure/Gnuboard7/*Pattern*"), (PAGE,)),
)


def scenarios_for(paths):
    selected = set()
    for path in paths:
        catalog = CATALOG_PREFIXES.get(Path(path).name) if path.startswith("resources/js/editor/") else None
        if catalog:
            selected.add(replace(PARITY, preset_prefixes=catalog))
            continue
        for patterns, scenarios in RULES:
            if any(fnmatchcase(path, pattern) for pattern in patterns):
                selected.update(scenarios)
                break
    grouped = {}
    for scenario in sorted(selected):
        key = (scenario.spec, scenario.projects)
        prior = grouped.get(key)
        if prior:
            titles = tuple(sorted(set(prior.titles + scenario.titles))) if prior.titles and scenario.titles else ()
            scenario = replace(scenario, titles=titles,
                               preset_prefixes=tuple(sorted(set(prior.preset_prefixes + scenario.preset_prefixes))))
        grouped[key] = scenario
    return tuple(sorted(grouped.values()))
