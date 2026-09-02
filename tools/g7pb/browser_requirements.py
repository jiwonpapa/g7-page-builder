"""Reviewed source-to-behavior mapping; selecting a test is not executing it.

Rules name existing user workflows, not source snippets. New source files must
belong to a declared feature area; unrelated tools/docs never trigger browsers.
"""
from dataclasses import dataclass
from fnmatch import fnmatchcase


@dataclass(frozen=True, order=True)
class BrowserScenario:
    spec: str
    projects: tuple[str, ...] = ("desktop",)


PAGE = BrowserScenario("tests/E2E/pageBuilderLifecycle.spec.ts")
TEXT = BrowserScenario("tests/E2E/editorInteractionQuality.spec.ts")
PARITY = BrowserScenario("tests/E2E/editorLayoutParity.spec.ts", ("desktop", "tablet", "mobile"))
PUBLIC = BrowserScenario("tests/E2E/publicQuality.spec.ts", ("desktop", "tablet", "mobile"))
SITE_PART = BrowserScenario("tests/E2E/sitePartLifecycle.spec.ts")
SITE_SHELL = BrowserScenario("tests/E2E/globalSiteShellRoutes.spec.ts", ("desktop", "tablet", "mobile"))
STORE = BrowserScenario("tests/E2E/officialStore.spec.ts")
MOBILE_NAV = BrowserScenario("tests/E2E/mobileNavigationQuality.spec.ts")

# Most-specific rules win, so a rich-text edit does not run every page workflow.
RULES = (
    (("resources/js/editor/layout*",), (PAGE,)),
    (("resources/js/editor/richText*", "resources/js/editor/fontSize.ts", "resources/js/editor/canvas*", "resources/js/editor/editorOverlaySafeZone.ts"), (TEXT,)),
    (("resources/js/editor/*CatalogBlocks.tsx", "resources/js/editor/catalogBlocks.tsx", "resources/js/editor/blockAppearance.ts", "resources/js/editor/pageDesignTokens.ts", "resources/js/editor/responsiveBlockStyle.tsx"), (PARITY,)),
    (("resources/js/editor/*SitePart*", "resources/js/editor/sitePart*", "resources/js/editor/useSitePart*", "src/*/SitePart*", "src/Domain/Site/*", "src/Application/Compilation/SitePartHtmlCompiler.php"), (SITE_PART,)),
    (("resources/js/public/siteShell*", "src/Application/SiteShell*", "src/Infrastructure/Gnuboard7/*SiteShell*"), (SITE_SHELL,)),
    (("resources/js/public/mobileNavigation*",), (MOBILE_NAV,)),
    (("resources/js/public/*", "resources/css/page-builder-public.css", "resources/css/page-effects*"), (PUBLIC,)),
    (("resources/js/store/*", "src/Application/Store/*", "src/Domain/Store/*", "src/Infrastructure/Store/*"), (STORE,)),
    (("resources/js/editor/PuckEditorAdapter.tsx",), (PAGE, TEXT)),
    (("resources/css/page-builder-editor*",), (PARITY, TEXT)),
    (("resources/css/page-builder-site-part*",), (SITE_PART,)),
    (("resources/js/editor/*", "resources/js/documents/*", "resources/js/api/*", "resources/js/manager/*", "resources/js/blocks/*", "resources/css/page-builder-core.css", "resources/css/page-builder-manager.css"), (PAGE,)),
    (("resources/css/*",), (PARITY, PUBLIC)),
    (("src/Application/Compilation/*",), (PAGE, PARITY)),
    (("src/Domain/Documents/*", "src/Domain/Publishing/*", "src/Domain/Patterns/*", "src/Application/PageBuilderService.php", "src/Application/Patterns/*", "src/Infrastructure/Gnuboard7/*PageBuilder*", "src/Infrastructure/Gnuboard7/*Document*", "src/Infrastructure/Gnuboard7/*Pattern*"), (PAGE,)),
)


def scenarios_for(paths):
    selected = set()
    for path in paths:
        for patterns, scenarios in RULES:
            if any(fnmatchcase(path, pattern) for pattern in patterns):
                selected.update(scenarios)
                break
    return tuple(sorted(selected))
