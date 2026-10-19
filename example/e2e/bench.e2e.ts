import { afterEach, beforeAll, describe, it } from '@jest/globals';
import { by, device, element, expect, waitFor } from 'detox';

// The bench auto-scrolls on timers, which Detox would otherwise wait on. It measures load times, so slow
// devices may finish with incomplete rows: the tests check that runs complete, not that all 60 images loaded.
describe('Bench', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterEach(async () => {
    await device.enableSynchronization();
  });

  it('runs one library on cold URLs', async () => {
    await element(by.id('variant-obi')).tap();
    await element(by.id('mode-thumb')).tap();
    await device.disableSynchronization();
    await element(by.id('goBench')).tap();
    await waitFor(element(by.text(/^\d+\/60 loaded · .*$/)))
      .toBeVisible()
      .withTimeout(60000);
    await element(by.id('back')).tap();
    await waitFor(element(by.text('Repeat with cached URLs')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('repeats the run with cached URLs', async () => {
    await device.disableSynchronization();
    await element(by.text('Repeat with cached URLs')).tap();
    await waitFor(element(by.text('obi / thumb · cached repeat')))
      .toBeVisible()
      .withTimeout(10000);
    await waitFor(element(by.text(/^\d+\/60 loaded · .*$/)))
      .toBeVisible()
      .withTimeout(60000);
    await element(by.id('back')).tap();
  });

  it('compares every library cold and cached', async () => {
    await device.disableSynchronization();
    await waitFor(element(by.id('runAll')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('runAll')).tap();
    await waitFor(element(by.text('Comparison · thumb')))
      .toBeVisible()
      .withTimeout(240000);
    await expect(
      element(by.text('6/6 runs · load times in ms · lower is better'))
    ).toBeVisible();
  });
});
