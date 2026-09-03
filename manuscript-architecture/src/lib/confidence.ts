// Confidence band logic shared by client and server.
// This is the one place where semantic greens/ambers/reds are correct.

import type { Band } from './types'

export const REVIEW_THRESHOLD = 0.65
export const CRITIC_CR_THRESHOLD = 0.45

/**
 * Signal floor. A geometric mean collapses to 0 when any signal is 0
 * (e.g. an unsourced block), which reads as a malfunction rather than a
 * measurement. "Unmeasurable" contributes its floor, not zero.
 */
const SIGNAL_FLOOR = 0.1
const eff = (s: number | null | undefined) => Math.max(s ?? 0, SIGNAL_FLOOR)

/** Composite confidence: weighted geometric mean of s1 and s2. */
export function composite(s1: number, s2: number): number {
  return Math.pow(eff(s1), 0.5) * Math.pow(eff(s2), 0.5)
}

/** Post-critic composite: C' = s1^0.4 * s2^0.3 * s3^0.3 */
export function compositeCritic(s1: number, s2: number, s3: number): number {
  return (
    Math.pow(eff(s1), 0.4) *
    Math.pow(eff(s2), 0.3) *
    Math.pow(eff(s3), 0.3)
  )
}

export function bandOf(confidence: number | null | undefined): Band {
  if (confidence === null || confidence === undefined) return 'none'
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.6) return 'medium'
  if (confidence >= 0.4) return 'low'
  return 'very-low'
}

export interface BandStyle {
  label: string
  border: string
  bg: string
  text: string
  bar: string
}

export const BAND_STYLE: Record<Band, BandStyle> = {
  high: {
    label: 'High',
    border: '#489260',
    bg: '#edf4ee',
    text: '#2f6b40',
    bar: '#489260',
  },
  medium: {
    label: 'Medium',
    border: '#9d824c',
    bg: '#f6f1e4',
    text: '#7a6335',
    bar: '#9d824c',
  },
  low: {
    label: 'Low',
    border: '#bd7962',
    bg: '#f7efe9',
    text: '#8f563f',
    bar: '#bd7962',
  },
  'very-low': {
    label: 'Very low',
    border: '#8f4e48',
    bg: '#f6ebea',
    text: '#743b36',
    bar: '#8f4e48',
  },
  none: {
    label: 'Unscored',
    border: '#c0ccd2',
    bg: '#f4f4f5',
    text: '#5c6a72',
    bar: '#c0ccd2',
  },
}

export function fmtConfidence(c: number | null | undefined): string {
  if (c === null || c === undefined) return '—'
  return c.toFixed(2)
}
