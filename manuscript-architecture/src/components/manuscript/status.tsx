'use client'

// Shared status visuals: glyph icons, labels, and chrome colors per block status.

import { CheckCheck, CircleDashed, Eye, Loader2, Lock, PenLine } from 'lucide-react'
import type { BlockStatus } from '@/lib/types'
import type { LucideIcon } from 'lucide-react'

export const STATUS_META: Record<
  BlockStatus,
  { label: string; icon: LucideIcon; spin?: boolean; color: string }
> = {
  placeholder: { label: 'placeholder', icon: CircleDashed, color: '#a8a29e' },
  drafting: { label: 'drafting', icon: Loader2, spin: true, color: '#d97706' },
  draft: { label: 'draft', icon: PenLine, color: '#0f766e' },
  in_review: { label: 'in review', icon: Eye, color: '#9d824c' },
  revised: { label: 'revised', icon: CheckCheck, color: '#489260' },
  frozen: { label: 'frozen', icon: Lock, color: '#57534e' },
}

/** Colors for the Board's stacked status bar. */
export const STATUS_BAR_COLORS: Record<BlockStatus, string> = {
  placeholder: '#d6d3d1',
  drafting: '#e7c66b',
  draft: '#6fb3bd',
  in_review: '#9d824c',
  revised: '#489260',
  frozen: '#57534e',
}
