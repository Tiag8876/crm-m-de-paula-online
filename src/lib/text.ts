const MOJIBAKE_MAP: Record<string, string> = {
  '\u00C3\u00A1': '\u00E1',
  '\u00C3\u00A0': '\u00E0',
  '\u00C3\u00A2': '\u00E2',
  '\u00C3\u00A3': '\u00E3',
  '\u00C3\u00A4': '\u00E4',
  '\u00C3\u00A9': '\u00E9',
  '\u00C3\u00A8': '\u00E8',
  '\u00C3\u00AA': '\u00EA',
  '\u00C3\u00AD': '\u00ED',
  '\u00C3\u00B3': '\u00F3',
  '\u00C3\u00B4': '\u00F4',
  '\u00C3\u00B5': '\u00F5',
  '\u00C3\u00B6': '\u00F6',
  '\u00C3\u00BA': '\u00FA',
  '\u00C3\u00BC': '\u00FC',
  '\u00C3\u00A7': '\u00E7',
  '\u00C3\u0081': '\u00C1',
  '\u00C3\u0089': '\u00C9',
  '\u00C3\u008D': '\u00CD',
  '\u00C3\u0093': '\u00D3',
  '\u00C3\u0094': '\u00D4',
  '\u00C3\u0095': '\u00D5',
  '\u00C3\u009A': '\u00DA',
  '\u00C3\u0087': '\u00C7',
  '\u00C3\u0083': '\u00C3',
  '\u00C2\u00BA': '\u00BA',
  '\u00C2\u00AA': '\u00AA',
  '\u00C2\u00B0': '\u00B0',
  '\u00C2\u00B7': '\u00B7',
  '\u00E2\u20AC\u201C': '\u2013',
  '\u00E2\u20AC\u201D': '\u2014',
  '\u00E2\u20AC\u0153': '\u201C',
  '\u00E2\u20AC\u009D': '\u201D',
  '\u00E2\u20AC\u02DC': '\u2018',
  '\u00E2\u20AC\u2122': '\u2019',
  '\u00E2\u20AC\u00A2': '\u2022',
};

const MOJIBAKE_SIGNALS = ['\u00C3', '\u00C2', '\u00E2', '\uFFFD'];

const countSignals = (value: string): number =>
  MOJIBAKE_SIGNALS.reduce((total, signal) => total + value.split(signal).length - 1, 0);

const rescueLatin1Utf8 = (value: string): string => {
  const bytes = Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 0xff));
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
};

export function normalizePtBrText(value: string): string {
  let output = value;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const currentScore = countSignals(output);
    if (currentScore === 0) {
      break;
    }

    const rescued = rescueLatin1Utf8(output);
    if (countSignals(rescued) < currentScore) {
      output = rescued;
      continue;
    }
    break;
  }

  for (const [broken, fixed] of Object.entries(MOJIBAKE_MAP)) {
    output = output.split(broken).join(fixed);
  }

  return output;
}

export function normalizePtBrDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return normalizePtBrText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizePtBrDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      normalized[key] = normalizePtBrDeep(nested);
    }
    return normalized as T;
  }

  return value;
}
