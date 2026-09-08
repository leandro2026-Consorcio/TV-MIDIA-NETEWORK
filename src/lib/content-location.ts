const NATIONAL_SCOPE_VALUES = new Set([
  'todas',
  'todos',
  'brasil',
  'todo o brasil',
  'nacional',
  'nacionalmente',
]);

export function normalizeContentLocation(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function contentCityMatches(contentCity: unknown, screenCity: unknown): boolean {
  const normalizedContentCity = normalizeContentLocation(contentCity);
  const normalizedScreenCity = normalizeContentLocation(screenCity);

  return !normalizedContentCity ||
    NATIONAL_SCOPE_VALUES.has(normalizedContentCity) ||
    normalizedContentCity === normalizedScreenCity;
}

export function contentRegionMatchesState(contentRegion: unknown, screenState: unknown): boolean {
  const normalizedRegion = normalizeContentLocation(contentRegion);
  const normalizedState = normalizeContentLocation(screenState);

  if (!normalizedRegion || NATIONAL_SCOPE_VALUES.has(normalizedRegion) || normalizedRegion === normalizedState) {
    return true;
  }

  const macroRegions: Record<string, string[]> = {
    norte: ['ac', 'ap', 'am', 'pa', 'ro', 'rr', 'to'],
    nordeste: ['al', 'ba', 'ce', 'ma', 'pb', 'pe', 'pi', 'rn', 'se'],
    'centro-oeste': ['df', 'go', 'mt', 'ms'],
    centrooeste: ['df', 'go', 'mt', 'ms'],
    sudeste: ['es', 'mg', 'rj', 'sp'],
    sul: ['pr', 'rs', 'sc'],
  };

  return (macroRegions[normalizedRegion] || []).includes(normalizedState);
}
