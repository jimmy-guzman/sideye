export type ActivityEventKind = "changed" | "appeared" | "removed"

export type ActivityEvent = {
  path: string
  at: number
  kind: ActivityEventKind
}

export type ActivityLog = {
  events: ActivityEvent[]
}

export type RecencyLevel = "fresh" | "recent" | "none"

export const FRESH_MS = 5_000
export const RECENT_MS = 30_000

const MAX_EVENTS = 1_000

export const emptyActivityLog: ActivityLog = { events: [] }

export function recordActivity(log: ActivityLog, entries: Array<{ path: string; kind: ActivityEventKind }>, now: number): ActivityLog {
  if (entries.length === 0) {
    return log
  }

  const events = [...log.events, ...entries.map((entry) => ({ path: entry.path, kind: entry.kind, at: now }))]
  return { events: events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events }
}

export function lastChangedAt(log: ActivityLog) {
  const byPath = new Map<string, number>()
  for (const event of log.events) {
    byPath.set(event.path, event.at)
  }

  return byPath
}

export function latestActivity(log: ActivityLog): ActivityEvent | undefined {
  return log.events.at(-1)
}

export function recencyLevel(at: number | undefined, now: number): RecencyLevel {
  if (at === undefined || now - at >= RECENT_MS) {
    return "none"
  }

  return now - at < FRESH_MS ? "fresh" : "recent"
}
