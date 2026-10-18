import { beforeAll, describe, it } from '@jest/globals';
import { by, device, element, expect, waitFor } from 'detox';

const SIZES = [256, 512, 1024];
// Every sample but the 60×60 PNG is 1280×720.
const SAMPLES: [id: string, size: (max: number) => string][] = [
  ['heic', (max) => `${max}×${(max * 720) / 1280}`],
  ['webp', (max) => `${max}×${(max * 720) / 1280}`],
  ['png', () => '60×60'],
  ['jpeg', (max) => `${max}×${(max * 720) / 1280}`],
];

async function openTranscode(photos: 'YES' | 'NO') {
  await device.launchApp({ newInstance: true, permissions: { photos } });
  await element(by.id('goTranscode')).tap();
}

describe('Transcode', () => {
  let run = 0;

  beforeAll(async () => {
    await openTranscode('YES');
  });

  it.each(
    SIZES.flatMap((max) =>
      SAMPLES.map(([id, size]) => [id, max, size(max)] as const)
    )
  )('%s at %ipx gives %s', async (id, max, size) => {
    await element(by.id(`maxSize-${max}`)).tap();
    await element(by.id(`transcode-${id}`)).tap();
    await waitFor(element(by.id(`resultSize-${run}`)))
      .toHaveText(size)
      .withTimeout(20000);
    run++;
  });

  it('transcodes the latest library photo', async () => {
    // Android emulators start with an empty media store.
    if (device.getPlatform() !== 'ios') return;
    await element(by.id('transcode-library')).tap();
    await waitFor(element(by.id(`resultSize-${run}`)))
      .toHaveText(/^\d+×\d+$/)
      .withTimeout(20000);
  });
});

describe('Transcode without Photos access', () => {
  beforeAll(async () => {
    await openTranscode('NO');
  });

  it('reports the denied library instead of crashing', async () => {
    if (device.getPlatform() !== 'ios') return;
    await element(by.id('transcode-library')).tap();
    await waitFor(element(by.id('resultError-0')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.id('resultLabel-0'))).toHaveText('Library');
  });
});
