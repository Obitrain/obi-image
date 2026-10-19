import { beforeAll, describe, it } from '@jest/globals';
import { by, device, element, expect } from 'detox';

describe('Home', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it.each([
    ['rn', 'thumb'],
    ['fast', 'card'],
    ['obi', 'classic'],
  ])('selects the %s variant and the %s mode', async (variant, mode) => {
    await element(by.id(`variant-${variant}`)).tap();
    await element(by.id(`mode-${mode}`)).tap();
    await expect(
      element(by.text(`Run bench: ${variant} / ${mode}`))
    ).toBeVisible();
    await expect(
      element(by.text(`Run all libraries · ${mode} (cold + cached)`))
    ).toBeVisible();
  });
});
