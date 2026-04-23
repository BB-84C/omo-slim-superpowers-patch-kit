/**
 * Collapse a mutable system-message array to a single provider-safe entry.
 */
export function collapseSystemInPlace(system: string[]): void {
  const joined = system.filter(Boolean).join('\n\n');
  system.splice(0, system.length, ...(joined ? [joined] : []));
}
