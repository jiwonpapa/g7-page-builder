import { startPageEffects } from './publicRuntime';
export { bootAccordions, bootTabs } from './publicContentControls';
export { bootInquiryForms } from './publicInquiryForms';
export { bootG7SystemControls, renderG7SystemControls } from './siteShellRuntime';
export { bootServiceActions } from './siteShellActions';
export { bootBlockVisibility, bootDynamicData } from './publicDataRuntime';
export { parseCounterText } from './publicMotion';
export { bootPageSliders } from './publicSliderLoader';
export { ensureSliderControls } from './publicSliderControls';
export { bootPageEffects, observePageEffects, bootSiteShellMenu, disposePageEffects } from './publicRuntime';

const buildMode = (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE;
const isTestRuntime = buildMode === 'test'
  || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test');
if (typeof window !== 'undefined' && typeof document !== 'undefined' && !isTestRuntime) startPageEffects();
import '../../css/page-builder-public.css';
import '../../css/page-builder-site-part-responsive.css';
import '../../css/page-builder-site-shell.css';
