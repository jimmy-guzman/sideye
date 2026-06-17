/**
 * The safety-poll cadence, as a pure function of two timestamps the refresh loop already tracks:
 * when git state last changed, and when the filesystem watcher last ticked. The watcher earns trust
 * by delivering ticks, so the poll relaxes only once it has — instant when the watcher works, never
 * slower than the old 750ms active poll when it does not, cheap when idle and proven, and
 * self-healing if the watcher goes quiet mid-session.
 */
const ACTIVE_MS = 10_000;

const FAST = "750 millis";
const QUIET = "2 seconds";
const TRUSTED = "10 seconds";

export function refreshDelay(input: {
  now: number;
  lastChangeAt: number;
  lastWatcherTickAt: number;
}) {
  const active = input.now - input.lastChangeAt < ACTIVE_MS;
  const proven = input.lastWatcherTickAt > 0;

  // Until the watcher has ever delivered a tick (e.g. Linux inotify failure), the
  // Poll is the only mechanism: fast while active, backed off when quiet.
  if (!proven) {
    return active ? FAST : QUIET;
  }

  // Proven: trust the watcher and slow right down, unless a recent change has no
  // Corresponding recent tick — then the watcher missed it, so poll hard until it
  // Catches up. One window for both, so a change the watcher DID catch (tick at
  // ~the same time as the change) never trips the fast path.
  const watcherStale = input.now - input.lastWatcherTickAt > ACTIVE_MS;
  if (active && watcherStale) {
    return FAST;
  }

  return TRUSTED;
}
