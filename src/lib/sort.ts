export type SortDir = 'asc' | 'desc'
export type SortState<K extends string> = { key: K; dir: SortDir }

/**
 * Toggle de sort: alterna asc/desc cuando se clickea la misma key,
 * o resetea a asc en una key nueva.
 */
export function toggleSort<K extends string>(
  prev: SortState<K>,
  key: K,
): SortState<K> {
  return prev.key === key
    ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: 'asc' }
}
