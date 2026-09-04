"""Reviewed source-to-behavior mapping; selection is not browser acceptance.

Catalog implementation changes select synthetic role contracts. Content changes
retain their separate bounded policy; code selection must never discover every
Page Kit or preset through the catalog manifest.
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
SITE_PART_HEADER = replace(SITE_PART, titles=(
    "edits and publishes the Header as an independent responsive Puck Site Part",))
SITE_SHELL = BrowserScenario("tests/E2E/globalSiteShellRoutes.spec.ts")
STORE = BrowserScenario("tests/E2E/officialStore.spec.ts")
MANAGER_STORE = BrowserScenario("tests/E2E/managerCodeContracts.spec.ts", titles=(
    "manages synthetic store and pack requests without crossing dialog owners",))
MANAGER_INBOX = replace(MANAGER_STORE, titles=(
    "keeps synthetic inquiry actions bound to their pending item",))
MOBILE_NAV = BrowserScenario("tests/E2E/mobileNavigationQuality.spec.ts")
PUBLIC_DATA = BrowserScenario("tests/E2E/publicRuntimeLifecycle.spec.ts", titles=(
    "loads synthetic public data and filters the loaded rows without another request",))
PUBLIC_CONTROLS = replace(PUBLIC_DATA, titles=(
    "hydrates typed public controls and submits only the active inquiry form",))
PUBLIC_MOTION = replace(PUBLIC_DATA, titles=(
    "initializes synthetic sliders and motion from the shipped bundle",))
PUBLIC_SHELL = replace(PUBLIC_DATA, titles=(
    "hydrates synthetic shell controls and keeps service requests explicit",))

# P1-P3 preserve the existing public/responsive and shell contracts. These
# additional desktop scenarios use synthetic DOM/API fixtures with the shipped
# bundle, not catalog content or real account/inquiry service acceptance.
PUBLIC_CODE_SCOPES = {
    **{"resources/js/public/" + name: (PUBLIC, PUBLIC_DATA, PUBLIC_CONTROLS, PUBLIC_MOTION, PUBLIC_SHELL)
       for name in ("pageEffects.ts", "publicRuntime.ts", "publicSliderLoader.ts")},
    "resources/js/public/publicValues.ts": (PUBLIC, PUBLIC_DATA, PUBLIC_SHELL),
    **{"resources/js/public/" + name: (PUBLIC, PUBLIC_DATA) for name in (
        "publicDataRendering.ts", "publicArchiveControls.ts", "publicDataRuntime.ts",
    )},
    "resources/js/public/publicHydration.ts": (PUBLIC, PUBLIC_DATA, PUBLIC_CONTROLS, PUBLIC_SHELL),
    **{"resources/js/public/" + name: (PUBLIC, PUBLIC_CONTROLS) for name in (
        "publicContentControls.ts", "publicInquiryForms.ts",
    )},
    **{"resources/js/public/" + name: (PUBLIC, PUBLIC_MOTION) for name in (
        "publicMotion.ts", "publicSliders.ts", "publicSliderEntry.ts", "publicSliderControls.ts",
    )},
    **{"resources/js/public/" + name: (SITE_SHELL, PUBLIC_SHELL) for name in (
        "siteShellControls.ts", "siteShellRuntime.ts", "siteShellActions.ts",
    )},
}
CATALOG_FRAME = BrowserScenario("tests/E2E/editorCatalogCode.spec.ts", titles=(
    "catalog frames preserve selection appearance and motion across families",))
CATALOG_FIELDS = replace(CATALOG_FRAME, titles=(
    "catalog fields and interactive previews retain edited values",))
CATALOG_CODEC = replace(CATALOG_FRAME, titles=(
    "catalog conversion preserves nested documents through save and reentry",))
CATALOG_RESPONSIVE = replace(CATALOG_FRAME, titles=(
    "catalog responsive overrides preserve inheritance and reset",))

# Exact reviewed owners for K1-K5. Existing mixed modules retain all three roles
# until their data/codec is extracted. No filename prefix invents a new exemption.
CATALOG_CODE_SCOPES = {
    **{"resources/js/editor/" + name: (CATALOG_FRAME, CATALOG_FIELDS, CATALOG_CODEC) for name in (
        "catalogBlocks.tsx", "foundationCatalogBlocks.tsx", "phase2CatalogBlocks.tsx",
        "phase3CatalogBlocks.tsx", "phase4CatalogBlocks.tsx", "productionCatalogBlocks.tsx",
    )},
    "resources/js/editor/CatalogBlockFrame.tsx": (CATALOG_FRAME, TEXT, CONTROLS),
    **{"resources/js/editor/" + name: (CATALOG_CODEC,) for name in (
        "foundationCatalogData.ts", "foundationCatalogCodec.ts", "phase2CatalogData.ts", "phase2CatalogCodec.ts",
        "phase3CatalogData.ts", "phase3CatalogCodec.ts", "phase4CatalogData.ts", "phase4CatalogCodec.ts",
        "productionCatalogData.ts", "productionCatalogCodec.ts", "catalogData.ts", "catalogCodec.ts",
        "catalogEditorTypes.ts",
    )},
    **{"resources/js/editor/" + name: (CATALOG_FRAME, CATALOG_CODEC) for name in (
        "catalogAppearance.ts", "blockMotionData.ts", "elementAppearanceData.ts",
    )},
    "resources/js/editor/blockMotion.tsx": (PAGE, CATALOG_FRAME, CATALOG_CODEC),
    "resources/js/editor/canvasEditingContract.ts": (TEXT, CONTROLS, CATALOG_FRAME, CATALOG_CODEC),
    "resources/js/editor/catalogPreviews.tsx": (CATALOG_FRAME, CATALOG_FIELDS, TEXT),
    "resources/js/editor/catalogFields.tsx": (CATALOG_FIELDS, TEXT),
    "resources/js/editor/CatalogGalleryThumbnail.tsx": (PAGE,),
    "resources/js/editor/puckBlockCodec.ts": (PAGE, TEXT, STRUCTURE_THEME, CATALOG_CODEC),
    "resources/js/editor/responsiveBlockData.ts": (CATALOG_CODEC, CATALOG_RESPONSIVE),
    "resources/js/editor/responsiveBlockStyle.tsx": (CATALOG_CODEC, CATALOG_RESPONSIVE),
    "resources/js/blocks/externalEditorRegistryData.ts": (PAGE, CATALOG_CODEC),
    "resources/js/blocks/runtimeRegistry.ts": (PAGE, CATALOG_CODEC),
}

# CSS owners select code-created documents and explicit UI roles. Content
# sweeps remain available under their existing full/content policies.
STYLE_CODE_SCOPES = {
    "resources/css/page-builder-editor-wysiwyg.css": (STRUCTURE_THEME,),
    # Shared shell visuals are consumed by the Puck Header and shipped public
    # menus independently of page-theme roots and desktop UI surfaces.
    "resources/css/page-builder-public.css": (STRUCTURE_THEME, SITE_PART_HEADER, PUBLIC_SHELL, MOBILE_NAV),
    "resources/css/page-builder-theme.css": (STRUCTURE_THEME, MANAGER_STORE, MANAGER_INBOX, PUBLIC_SHELL, SITE_PART_HEADER, MOBILE_NAV),
    "resources/css/page-builder-editor.css": (CONTROLS, STRUCTURE_THEME, SITE_PART_HEADER),
    "resources/css/page-builder-site-part-responsive.css": (SITE_PART_HEADER, PUBLIC_SHELL, MOBILE_NAV),
    "resources/css/page-builder-site-shell.css": (SITE_PART_HEADER, PUBLIC_SHELL, MOBILE_NAV),
    "resources/js/public/mobileNavigation.css": (MOBILE_NAV, PUBLIC_SHELL),
    "resources/css/page-builder-core.css": (STRUCTURE_THEME, MANAGER_STORE, MANAGER_INBOX),
    "resources/css/page-builder-manager.css": (PAGE, MANAGER_STORE, MANAGER_INBOX),
    "resources/css/page-builder-editor-chrome.css": (PAGE, CONTROLS, STRUCTURE_THEME),
    "resources/css/page-builder-editor-library.css": (PAGE, STRUCTURE_THEME),
    "resources/css/page-builder-editor-controls.css": (TEXT, CONTROLS, STRUCTURE_THEME),
    "resources/css/page-builder-editor-canvas.css": (NESTED, CONTROLS, STRUCTURE_THEME),
    "resources/css/page-builder-editor-blocks.css": (TEXT, STRUCTURE_THEME),
    "resources/css/page-builder-editor-catalog.css": (CATALOG_FRAME, CATALOG_FIELDS, CATALOG_RESPONSIVE),
    "resources/css/page-builder-editor-appearance.css": (TEXT, STRUCTURE_THEME, CATALOG_RESPONSIVE),
}

# Most-specific source rules win. Adding a scenario requires a real registered
# Playwright test; a missing spec/title must fail instead of claiming acceptance.
RULES = (
    # The planner admits this view only for the byte-identical root-class addition.
    (("resources/views/viewer.blade.php",), (PAGE, STRUCTURE_THEME)),
    # The compiler family owns publishing, nested markup and typed responsive output.
    # These existing synthetic scenarios never enumerate preset/catalog content.
    (("src/Application/Compilation/HtmlDocumentCompiler.php", "src/Application/Compilation/HtmlDocument/*"),
     (PAGE, NESTED, STRUCTURE_THEME)),
    # Manager UI requests use synthetic API responses. Real catalog content,
    # installation, and store approval remain the separate STORE contract.
    (("resources/js/manager/PageBuilderManager.tsx",), (PAGE, MANAGER_STORE, MANAGER_INBOX)),
    (("resources/js/manager/useManagerStore.ts", "resources/js/manager/ManagerStoreDialogs.tsx",
      "resources/js/manager/useManagerBlockPacks.ts", "resources/js/manager/ManagerBlockPacksDialog.tsx"), (MANAGER_STORE,)),
    (("resources/js/manager/ManagerInboxDialog.tsx",), (MANAGER_INBOX,)),
    # Document transactions and shared style contracts use synthetic code fixtures,
    # not preset/catalog content sweeps. Catalog modules retain their own mapping.
    (("resources/js/editor/PuckEditorAdapter.tsx",), (PAGE, TEXT, STRUCTURE_THEME, DOCUMENT_BOUNDARY)),
    # Extracted config and built-in previews retain canonical editing, inline
    # text, and nested/style contracts when changed without the adapter facade.
    (("resources/js/editor/puckEditorConfig.tsx", "resources/js/editor/puckBuiltinPreviews.tsx"), (PAGE, TEXT, STRUCTURE_THEME)),
    (("resources/js/editor/previewContent.ts",), (PAGE, TEXT)),
    # FullSiteCanvas owns its shell context; editing contexts do not own the
    # template/home route contract.
    (("resources/js/editor/FullSiteCanvas.tsx",), (TEMPLATE, TEXT)),
    (("resources/js/editor/puckEditorContexts.ts",), (TEXT, CONTROLS, STRUCTURE_THEME)),
    # Gallery transport/selection and motion commands keep the existing page
    # workflow, including builder shell resources and batch motion controls.
    (("resources/js/editor/blockGalleryModel.ts", "resources/js/editor/BlockGalleryControls.tsx",
      "resources/js/editor/BlockCatalogContext.ts", "resources/js/editor/blockMotionCommands.ts",
      "resources/js/editor/usePageBuilderResources.ts"), (PAGE,)),
    (("resources/js/editor/EditorHeaderControls.tsx",), (PAGE, CONTROLS, STRUCTURE_THEME)),
    (("resources/js/editor/CanvasContextControls.tsx", "resources/js/editor/SelectedBlockActionBar.tsx",
      "resources/js/editor/useCanvasEditingUi.ts"), (PAGE, TEXT, CONTROLS)),
    (("resources/js/editor/useSelectedActionBarSafeZone.ts", "resources/js/editor/useEditorViewport.ts"), (TEXT, CONTROLS)),
    (("resources/js/editor/canvasItemCommands.ts",), (PAGE, TEXT)),
    (("resources/js/editor/usePageBuilderSession.ts",), (PAGE, TEXT, STRUCTURE_THEME, DOCUMENT_BOUNDARY)),
    # Rich-text models/selection/commands retain the richText* rule below;
    # extracted floating tools also require the real pointer reachability case.
    (("resources/js/editor/richTextFloatingLayer.tsx", "resources/js/editor/richTextInlineMenu.tsx"), (TEXT, CONTROLS)),
    (("resources/js/editor/main.tsx",), (PAGE, DOCUMENT_BOUNDARY)),
    (("resources/js/editor/PuckDocumentBoundary.tsx", "resources/js/editor/editorDocumentBoundary.ts",
      "resources/js/editor/draftPersistence.ts"), (DOCUMENT_BOUNDARY,)),
    (("resources/js/editor/layout*", "resources/js/documents/layout*"), (NESTED, STRUCTURE_THEME)),
    (("resources/js/editor/puckLayoutData.ts",), (NESTED, STRUCTURE_THEME)),
    (("resources/js/editor/blockInspectorFields.tsx",), (PAGE,)),
    (("resources/js/editor/richText*", "resources/js/editor/fontSize.ts"), (TEXT,)),
    (("resources/js/editor/canvas*",), (TEXT, CONTROLS)),
    (("resources/js/editor/editorOverlaySafeZone.ts", "resources/js/editor/editorViewportPolicy.ts"), (CONTROLS,)),
    (("resources/js/editor/puckEditorSelection.ts",), (NESTED, CONTROLS, STRUCTURE_THEME)),
    (("resources/js/editor/SectionPatternControls.tsx", "resources/js/editor/EditorPortal.tsx"), (PAGE, STRUCTURE_THEME)),
    (("resources/js/editor/pageDesignTokens.ts", "src/Domain/Documents/PageDesignTokens.php", "src/Application/Compilation/DocumentThemeCompiler.php"), (STRUCTURE_THEME, PARITY)),
    (("resources/js/editor/blockAppearance.ts",), (STRUCTURE_THEME, TEXT)),
    (("src/Application/Compilation/ElementAppearanceCompiler.php",), (STRUCTURE_THEME,)),
    (("src/Application/Compilation/RichTextSanitizer.php",), (TEXT,)),
    (("src/Application/Compilation/CompilationUrlPolicy.php",), (PAGE,)),
    (("resources/js/editor/*SitePart*", "resources/js/editor/sitePart*", "resources/js/editor/useSitePart*", "src/*/SitePart*", "src/Domain/Site/*", "src/Application/Compilation/SitePartHtmlCompiler.php"), (SITE_PART,)),
    (("resources/js/public/siteShell*", "src/Application/SiteShell*", "src/Infrastructure/Gnuboard7/*SiteShell*"), (SITE_SHELL,)),
    (("resources/js/public/mobileNavigation*",), (MOBILE_NAV,)),
    (("resources/js/public/*", "resources/css/page-effects*"), (PUBLIC,)),
    (("resources/css/page-builder-public.css", "resources/css/page-builder-theme.css"), (STRUCTURE_THEME,)),
    (("resources/js/store/*", "src/Application/Store/*", "src/Domain/Store/*", "src/Infrastructure/Store/*"), (STORE,)),
    (("resources/js/editor/puckDocumentAdapter.ts",), (PAGE, TEXT, STRUCTURE_THEME)),
    (("resources/css/page-builder-editor*",), (CONTROLS, STRUCTURE_THEME)),
    (("resources/css/page-builder-site-part*",), (SITE_PART_HEADER,)),
    (("resources/css/page-builder-core.css",), (STRUCTURE_THEME,)),
    (("resources/js/editor/*", "resources/js/documents/*", "resources/js/api/*", "resources/js/manager/*", "resources/js/blocks/*", "resources/css/page-builder-manager.css"), (PAGE,)),
    (("resources/css/*",), (PARITY, PUBLIC)),
    (("src/Application/Compilation/*",), (PAGE, PARITY)),
    (("src/Domain/Documents/*", "src/Domain/Publishing/*", "src/Domain/Patterns/*", "src/Application/PageBuilderService.php", "src/Application/Patterns/*", "src/Infrastructure/Gnuboard7/*PageBuilder*", "src/Infrastructure/Gnuboard7/*Document*", "src/Infrastructure/Gnuboard7/*Pattern*"), (PAGE,)),
)


def scenarios_for(paths):
    selected = set()
    for path in paths:
        owned = STYLE_CODE_SCOPES.get(path) or CATALOG_CODE_SCOPES.get(path) or PUBLIC_CODE_SCOPES.get(path)
        if owned:
            selected.update(owned)
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
