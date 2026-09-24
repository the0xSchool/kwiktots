const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
]

const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function relativeTime(isoDate: string, now: Date = new Date()): string {
  const then = new Date(isoDate)
  const seconds = Math.round((then.getTime() - now.getTime()) / 1000)

  if (Math.abs(seconds) < 60) {
    return 'just now'
  }

  for (const [unit, unitSeconds] of UNITS) {
    if (Math.abs(seconds) >= unitSeconds) {
      return formatter.format(Math.round(seconds / unitSeconds), unit)
    }
  }

  return formatter.format(Math.round(seconds / 60), 'minute')
}
