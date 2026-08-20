import ExpoFontLoader from '../ExpoFontLoader.web';

// fontfaceobserver waits for a real font file, which never arrives in a test
// environment. The rules this test reads are written before the observer runs.
jest.mock(
  'fontfaceobserver',
  () =>
    class FontObserverMock {
      load() {
        return Promise.resolve();
      }
    }
);

const STYLE_ID = 'expo-generated-fonts';

function countRules(): number {
  const element = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  return element?.sheet ? element.sheet.cssRules.length : 0;
}

if (typeof window === 'undefined') {
  it(`noop`, () => {});
} else {
  // jsdom parses `@font-face` rules but does not define the `CSSFontFaceRule`
  // interface, which the loader uses to select the rules it wrote. Take the
  // interface from a parsed rule.
  beforeAll(() => {
    if (typeof (globalThis as any).CSSFontFaceRule === 'undefined') {
      const style = document.createElement('style');
      style.textContent = '@font-face{font-family:"probe";src:url("probe.ttf")}';
      document.head.appendChild(style);
      const rule = style.sheet!.cssRules[0];
      (globalThis as any).CSSFontFaceRule = Object.getPrototypeOf(rule).constructor;
      style.remove();
    }
  });

  afterEach(() => {
    document.getElementById(STYLE_ID)?.remove();
  });

  // A browser can write the family name back with quotes, and it always does for a
  // name that needs them, such as a name with a space.
  it.each(['Inter', 'DIN 2014'])(`finds the rule it wrote for %p`, async (fontFamily) => {
    await ExpoFontLoader.loadAsync(fontFamily, { uri: 'font.ttf' });

    expect(ExpoFontLoader.isLoaded(fontFamily)).toBe(true);
    expect(ExpoFontLoader.getLoadedFonts()).toEqual([fontFamily]);
    expect(countRules()).toBe(1);

    // A second call must not write the same rule again.
    await ExpoFontLoader.loadAsync(fontFamily, { uri: 'font.ttf' });
    expect(countRules()).toBe(1);

    await ExpoFontLoader.unloadAsync(fontFamily);
    expect(ExpoFontLoader.isLoaded(fontFamily)).toBe(false);
    expect(countRules()).toBe(0);
  });

  it(`does not match a family that was not loaded`, async () => {
    await ExpoFontLoader.loadAsync('DIN 2014', { uri: 'font.ttf' });

    expect(ExpoFontLoader.isLoaded('DIN')).toBe(false);
    expect(ExpoFontLoader.isLoaded('DIN 2014 Bold')).toBe(false);
  });

  it(`matches on the display descriptor`, async () => {
    await ExpoFontLoader.loadAsync('DIN 2014', { uri: 'font.ttf', display: 'swap' } as any);

    expect(ExpoFontLoader.isLoaded('DIN 2014', { display: 'swap' } as any)).toBe(true);
    expect(ExpoFontLoader.isLoaded('DIN 2014', { display: 'block' } as any)).toBe(false);

    await ExpoFontLoader.unloadAsync('DIN 2014', { display: 'block' } as any);
    expect(countRules()).toBe(1);

    await ExpoFontLoader.unloadAsync('DIN 2014', { display: 'swap' } as any);
    expect(countRules()).toBe(0);
  });
}
