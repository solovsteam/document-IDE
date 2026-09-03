// Shared types for The Manuscript Architecture prototype (client + server safe)

export type BlockStatus =
  | 'placeholder'
  | 'drafting'
  | 'draft'
  | 'in_review'
  | 'revised'
  | 'frozen'

export type BlockType = 'heading' | 'paragraph'

export type OrchState = 'idle' | 'running' | 'paused'

export type Actor =
  | 'human'
  | 'drafter'
  | 'critic'
  | 'planner'
  | 'gatekeeper'
  | 'system'

export type EventType =
  | 'BlockPatched'
  | 'StatusChanged'
  | 'ConfidenceUpdated'
  | 'MessagePosted'
  | 'CRFiled'
  | 'CRResolved'
  | 'TaskSpawned'
  | 'TaskFinished'
  | 'BudgetUpdated'
  | 'OrchStateChanged'
  | 'SessionReset'

export type Band = 'high' | 'medium' | 'low' | 'very-low' | 'none'

export interface AlternativeView {
  text: string
  why: string
}

export interface BlockMetaView {
  confidence: number | null
  s1: number | null
  s2: number | null
  s3: number | null
  rationale: string | null
  alternatives: AlternativeView[]
  openQuestions: string[]
}

export interface SourceView {
  title: string
  snippet: string
  uri: string
  claimSpan: string
}

export interface BlockView {
  id: string
  orderIdx: number
  blockNo: string
  type: BlockType
  content: string
  status: BlockStatus
  updatedAt: string
  meta: BlockMetaView | null
  sources: SourceView[]
}

export type CROrigin = 'human' | 'critic'
export type CRStatus = 'open' | 'approved' | 'applied' | 'discarded'

export interface CRView {
  id: string
  blockId: string
  blockNo: string
  origin: CROrigin
  instruction: string
  status: CRStatus
  createdAt: string
}

export type MessageRole = 'human' | 'agent' | 'system'

export interface MessageView {
  id: string
  role: MessageRole
  body: string
  pinnedBlockId: string | null
  pinnedBlockNo: string | null
  createdAt: string
}

export interface EventView {
  id: number
  type: EventType | 'hello'
  actor: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface BudgetView {
  used: number
  total: number
}

export interface FoldState {
  cursor: number
  document: { id: string; title: string } | null
  blocks: BlockView[]
  changeRequests: CRView[]
  messages: MessageView[]
  budget: BudgetView
  orchestratorState: OrchState
  events: EventView[]
}

// ---- Event payload shapes (server -> client) ----

export interface BlockPatchedPayload {
  blockId: string
  blockNo: string
  delta: string
  mode: 'append' | 'replace'
}

export interface StatusChangedPayload {
  blockId: string
  blockNo: string
  from: BlockStatus
  to: BlockStatus
  crId: string | null
}

export interface ConfidenceUpdatedPayload {
  blockId: string
  blockNo: string
  meta: BlockMetaView
}

export interface MessagePostedPayload {
  message: MessageView
}

export interface CRFiledPayload {
  cr: CRView
}

export interface CRResolvedPayload {
  crId: string
  blockId: string
  blockNo: string
  status: CRStatus
}

export interface TaskPayload {
  taskId: string
  kind: 'draft' | 'critic' | 'revise'
  blockId: string
  blockNo: string
}

export interface BudgetUpdatedPayload {
  used: number
  total: number
}

export interface OrchStateChangedPayload {
  state: OrchState
}

export function blockNoOf(orderIdx: number): string {
  return `b_${String(orderIdx + 1).padStart(3, '0')}`
}
