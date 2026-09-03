'use client'

// SSE subscription with manual reconnect + backoff.
// On reconnect the store fully rehydrates from /api/state to avoid replays.

import { useEffect } from 'react'
import { useManuscript } from '@/lib/store'
import type { EventView } from '@/lib/types'

export function useManuscriptStream(): void {
  useEffect(() => {
    let es: EventSource | null = null
    let disposed = false
    let attempt = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      if (disposed) return
      const store = useManuscript.getState()
      store.setConnection(attempt === 0 ? 'connecting' : 'reconnecting')

      es = new EventSource('/api/events')

      es.onopen = () => {
        attempt = 0
        useManuscript.getState().setConnection('open')
      }

      es.onmessage = (ev: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(ev.data) as EventView
          useManuscript.getState().applyEvent(parsed)
        } catch {
          /* ignore malformed frames */
        }
      }

      es.onerror = () => {
        es?.close()
        es = null
        if (disposed) return
        useManuscript.getState().setConnection('reconnecting')
        const delay = Math.min(10_000, 1000 * 2 ** attempt)
        attempt += 1
        retryTimer = setTimeout(() => {
          void useManuscript.getState().hydrate().then(connect)
        }, delay)
      }
    }

    void useManuscript.getState().hydrate().then(connect)

    return () => {
      disposed = true
      if (retryTimer) clearTimeout(retryTimer)
      es?.close()
    }
  }, [])
}
