'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useManuscript } from '@/lib/store'
import { cn } from '@/lib/utils'
import { CornerDownLeft, Pin } from 'lucide-react'
import type { MessageView } from '@/lib/types'

function MessageBubble({ msg }: { msg: MessageView }) {
  const isHuman = msg.role === 'human'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center px-2">
        <p className="max-w-md rounded-md bg-stone-100 px-2.5 py-1 text-center text-[11px] leading-snug text-stone-500">
          {msg.pinnedBlockNo && (
            <Pin className="mr-1 inline h-3 w-3 -translate-y-px" aria-hidden />
          )}
          {msg.body}
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex px-2', isHuman ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed shadow-sm',
          isHuman
            ? 'rounded-br-sm bg-[#227fad] text-white'
            : 'rounded-bl-sm border border-stone-200 bg-white text-stone-800',
        )}
      >
        {msg.pinnedBlockNo && (
          <span
            className={cn(
              'mb-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-px font-mono text-[9px]',
              isHuman ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500',
            )}
          >
            <Pin className="h-2.5 w-2.5" aria-hidden /> pinned to {msg.pinnedBlockNo}
          </span>
        )}
        <p className="whitespace-pre-wrap">{msg.body}</p>
      </div>
    </div>
  )
}

export function ChatPanel() {
  const { toast } = useToast()
  const messages = useManuscript((s) => s.messages)
  const selectedBlockId = useManuscript((s) => s.selectedBlockId)
  const blocks = useManuscript((s) => s.blocks)
  const [input, setInput] = useState('')
  const [pinned, setPinned] = useState(false)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null
  const selectedNo = selectedBlock?.blockNo ?? null

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const send = async () => {
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body,
          pinnedBlockId: pinned && selectedBlockId ? selectedBlockId : null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast({ title: 'Message refused', description: data.error, variant: 'destructive' })
        return
      }
      setInput('')
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto py-3 max-h-96 lg:max-h-none"
        aria-label="Chat transcript"
      >
        {messages.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-stone-400">
            No messages yet. Say something — or pin feedback to a selected block to
            trigger a targeted revision.
          </p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} msg={m} />)
        )}
      </div>

      <div className="border-t border-stone-200 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="pin-toggle"
              checked={pinned && Boolean(selectedBlockId)}
              disabled={!selectedBlockId}
              onCheckedChange={(v) => setPinned(v)}
            />
            <Label
              htmlFor="pin-toggle"
              className={cn(
                'text-[11px]',
                selectedBlockId ? 'text-stone-600' : 'text-stone-400',
              )}
            >
              {selectedBlockId
                ? `Pin to ${selectedNo} (${selectedBlock?.status})`
                : 'Select a block to pin'}
            </Label>
          </div>
          <span className="font-mono text-[10px] text-stone-300">
            {messages.length} msg
          </span>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder={
              pinned && selectedNo
                ? `Feedback for ${selectedNo} — files a change request against that block only…`
                : 'Unpinned note to the session transcript…'
            }
            className="min-h-10 flex-1 resize-none border-stone-300 text-xs"
            rows={2}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || sending}
            className="h-10 bg-[#227fad] px-3 text-white hover:bg-[#1c6c94]"
            aria-label="Send message"
          >
            <CornerDownLeft className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      </div>
    </div>
  )
}
