import '../../css/page-builder-manager.css';

import { discoverPageBuilderManagers, mountPageBuilderManager } from './PageBuilderManager';

function autoMountManagers(): void {
  for (const element of discoverPageBuilderManagers()) {
    mountPageBuilderManager(element, {
      locale: (element as HTMLElement).dataset.locale ?? 'ko',
    });
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMountManagers, { once: true });
  } else {
    queueMicrotask(autoMountManagers);
  }
}
