import type { SystemControlKind } from '../documents/v3/types';
import type { ShellOptions } from './siteShellControls';

/** Fixed runtime options derived from a capability, never an authored handler. */
export function systemControlOptions(kind: SystemControlKind): ShellOptions {
  const options: ShellOptions = { search: false, account: false, cart: false, notifications: false, theme: false, locale: false, currency: false };
  options[kind] = true;
  return options;
}

/** Decorate only the module's generated markup; document HTML/CSS is not accepted. */
export function decorateSystemMarkup(markup: string, preview = false): string {
  if (preview) markup = markup.replace(/(data-g7pb-system-(?:member|commerce)) hidden/g, '$1');
  const button = 'width:100%;height:100%;min-width:0;min-height:0;padding:0;border:0;font:inherit;color:inherit;background:inherit;'
    + (preview ? 'display:inline-flex;align-items:center;justify-content:center;' : '');
  return markup.replaceAll('class="g7pb-shell-icon"', 'class="g7pb-shell-icon" style="' + button + '"')
    .replaceAll('class="g7pb-shell-tool"', 'class="g7pb-shell-tool" style="position:relative;width:100%;height:100%;font:inherit;color:inherit;"')
    .replaceAll('<svg ', '<svg style="width:1em;height:1em;flex-shrink:0;" ');
}
