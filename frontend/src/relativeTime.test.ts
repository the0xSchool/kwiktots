import { describe, expect, it } from 'vitest'
import { relativeTime } from './relativeTime'

const NOW = new Date('2026-01-15T12:00:00Z')

function secondsAgo(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString()
}

function secondsAhead(seconds: number): string {
  return new Date(NOW.getTime() + seconds * 1000).toISOString()
}

describe('relativeTime', () => {
  it('reports a moment a few seconds ago as just now', () => {
    expect(relativeTime(secondsAgo(30), NOW)).toBe('just now')
  })

  it('reports minutes ago', () => {
    expect(relativeTime(secondsAgo(5 * 60), NOW)).toBe('5 minutes ago')
  })

  it('reports hours ago', () => {
    expect(relativeTime(secondsAgo(2 * 60 * 60), NOW)).toBe('2 hours ago')
  })

  it('reports days ago', () => {
    expect(relativeTime(secondsAgo(3 * 24 * 60 * 60), NOW)).toBe('3 days ago')
  })

  it('reports a moment a few seconds in the future as just now', () => {
    expect(relativeTime(secondsAhead(45), NOW)).toBe('just now')
  })

  it('reports minutes in the future when the server clock is ahead', () => {
    expect(relativeTime(secondsAhead(10 * 60), NOW)).toBe('in 10 minutes')
  })
})
