/** IANA zones for selects. Intl's list omits "UTC" itself, so it is added first. */
export function timeZones(): string[] {
  const list = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return ['UTC', ...list.filter((z) => z !== 'UTC')];
}
