import { beforeAll, describe, it } from '@jest/globals';
import { by, device, element, expect, waitFor } from 'detox';

describe('Demo', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await element(by.id('goDemo')).tap();
  });

  it('counts taps on the image overlay', async () => {
    await element(by.id('tap')).tap();
    await expect(element(by.id('count'))).toHaveText('taps: 1');
    await element(by.id('tap')).tap();
    await expect(element(by.id('count'))).toHaveText('taps: 2');
  });

  it('reports a 404 through onError', async () => {
    await waitFor(element(by.id('err')))
      .toHaveText('error')
      .withTimeout(15000);
  });

  it('prefetches the first rows', async () => {
    await element(by.id('prefetch')).tap();
    await waitFor(element(by.id('prefetched')))
      .toHaveText(/^prefetched 20 in \d+ ms$/)
      .withTimeout(30000);
  });

  it('scrolls the 200-row recycling list to the end', async () => {
    await element(by.id('goList')).tap();
    await element(by.id('recycleList')).scrollTo('bottom');
    await expect(element(by.text('row 199'))).toBeVisible();
    await element(by.id('back')).tap();
    await expect(element(by.id('goList'))).toBeVisible();
  });
});
