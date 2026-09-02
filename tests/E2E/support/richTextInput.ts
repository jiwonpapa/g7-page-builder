import { expect, type Locator, type Page } from '@playwright/test';

export async function waitForStableLayout(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

export async function pointerHitEvidence(targetLocator: Locator, position?: { x: number; y: number }) {
  return targetLocator.evaluate((target, requestedPosition) => {
    const rect = target.getBoundingClientRect();
    const point = requestedPosition
      ? { x: rect.left + requestedPosition.x, y: rect.top + requestedPosition.y }
      : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const hit = document.elementFromPoint(point.x, point.y);
    const controls = target.closest('.g7pb-header-controls');
    const controlsRect = controls?.getBoundingClientRect();

    return {
      ariaExpanded: target.getAttribute('aria-expanded'),
      point,
      target: {
        ariaLabel: target.getAttribute('aria-label'),
        bottom: rect.bottom,
        className: target.getAttribute('class'),
        height: rect.height,
        id: target.id || null,
        left: rect.left,
        right: rect.right,
        tagName: target.tagName,
        testId: target.getAttribute('data-testid'),
        text: target.textContent?.trim().slice(0, 80) || null,
        top: rect.top,
        width: rect.width,
      },
      controls: controls && controlsRect
        ? {
            bottom: controlsRect.bottom,
            display: getComputedStyle(controls).display,
            height: controlsRect.height,
            left: controlsRect.left,
            position: getComputedStyle(controls).position,
            right: controlsRect.right,
            top: controlsRect.top,
            width: controlsRect.width,
          }
        : null,
      hit: hit
        ? {
            ariaLabel: hit.getAttribute('aria-label'),
            className: hit.getAttribute('class'),
            id: hit.id || null,
            tagName: hit.tagName,
            testId: hit.getAttribute('data-testid'),
            text: hit.textContent?.trim().slice(0, 80) || null,
          }
        : null,
      topmost: hit === target || target.contains(hit),
      viewport: {
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        width: window.innerWidth,
      },
    };
  }, position);
}

export async function activatePointerTarget(
  page: Page,
  target: Locator,
  label: string,
  position?: { x: number; y: number },
): Promise<void> {
  await expect(target, `${label} must be visible before pointer activation`).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  await waitForStableLayout(page);
  const evidence = await pointerHitEvidence(target, position);
  if (!evidence.topmost) {
    throw new Error(`${label} is not the topmost pointer target: ${JSON.stringify(evidence)}`);
  }
  await target.click(position ? { position } : undefined);
}

async function activatePuckRichTextField(page: Page, field: Locator, label: string): Promise<void> {
  await expect(field, `${label} must be visible before rich-text activation`).toBeVisible();
  await field.scrollIntoViewIfNeeded();
  await field.hover();
  // Puck's temporary fallback is also contenteditable; wait for the actual Tiptap input.
  await expect(field).toHaveClass(/\bProseMirror\b/);
  await expect(field).toHaveAttribute('contenteditable', 'true');
  await activatePointerTarget(page, field, label);
  await expect(field).toBeEditable();
}

export async function replacePuckRichTextField(page: Page, field: Locator, value: string, label: string): Promise<void> {
  await activatePuckRichTextField(page, field, label);
  await expect(field, `${label} must own keyboard focus before replacement`).toBeFocused();
  const previousText = await field.textContent() ?? '';
  // Use the editor's native select-all command. fill() selects a DOM Range
  // without checking that the rich-text editor has accepted that selection.
  await page.keyboard.press('ControlOrMeta+A');
  await expect.poll(() => field.evaluate((element) => {
    const selection = element.ownerDocument.getSelection();
    return {
      focused: element.ownerDocument.activeElement === element,
      ownsSelection: Boolean(selection?.anchorNode && selection.focusNode
        && element.contains(selection.anchorNode) && element.contains(selection.focusNode)),
      selectedText: selection?.toString() ?? null,
      fieldText: element.textContent ?? '',
    };
  }), { message: `${label} must select its entire text before replacement` }).toEqual({
    focused: true,
    ownsSelection: true,
    selectedText: previousText,
    fieldText: previousText,
  });
  await page.keyboard.insertText(value);
  await expect(field, `${label} must contain only the replacement text`).toHaveText(value);
}
