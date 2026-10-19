import { beforeAll, describe, it } from '@jest/globals';
import { by, device, element, expect, waitFor } from 'detox';

// Small CI screens put the lower buttons below the fold; Espresso only taps views that are mostly visible.
// Swipes start mid-view: from the bottom edge, Android's gesture navigation would send the app home.
async function scrollTo(id: string) {
  await waitFor(element(by.id(id)))
    .toBeVisible()
    .whileElement(by.id('demoScroll'))
    .scroll(200, 'down', NaN, 0.5);
}

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
    await scrollTo('prefetch');
    await element(by.id('prefetch')).tap();
    await waitFor(element(by.id('prefetched')))
      .toHaveText(/^prefetched 20 in \d+ ms$/)
      .withTimeout(30000);
  });

  it('scrolls deep into the 200-row recycling list', async () => {
    await scrollTo('goList');
    await element(by.id('goList')).tap();
    // Far enough to recycle every cell several times; scrollTo('bottom') gives up on small screens.
    await waitFor(element(by.text('row 120')))
      .toBeVisible()
      .whileElement(by.id('recycleList'))
      .scroll(1000, 'down', NaN, 0.5);
    await element(by.id('back')).tap();
    // The Demo screen remounts scrolled to the top.
    await scrollTo('goList');
  });
});
