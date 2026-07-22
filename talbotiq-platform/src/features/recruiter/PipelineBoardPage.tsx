import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { pipelinesApi } from '@/lib/api'
import { Card, Button, Badge, PageHeader, Skeleton, cn } from '@/components/ui'
import type { BoardCard, BoardColumn } from '@shared/types'

/** Per-round status shown on a card. Mirrors `buildBoard`'s `roundStatus`
 *  derivation in server/routes/pipelines.ts (join of report + session state). */
const ROUND_STATUS_LABEL: Record<BoardCard['roundStatus'], { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
  completed: { label: 'Scored', variant: 'success' },
  in_progress: { label: 'In progress', variant: 'info' },
  invited: { label: 'Invited', variant: 'neutral' },
  expired: { label: 'Expired', variant: 'danger' },
  none: { label: 'Invited', variant: 'neutral' },
}

function Cardlet({ card }: { card: BoardCard }) {
  const s = ROUND_STATUS_LABEL[card.roundStatus]
  return (
    // `advanceable` (in_round + scored) gets a subtle ring — a visual cue only;
    // acting on it (drag/advance) is Plan 4.
    <div className={cn('card p-3', card.advanceable && 'ring-1 ring-primary-300')}>
      <div className="truncate text-sm font-medium text-neutral-800">{card.candidateName || card.candidateEmail}</div>
      <div className="truncate text-xs text-neutral-400">{card.candidateEmail}</div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Badge variant={s.variant}>{s.label}</Badge>
        {card.score !== null
          ? <span className="text-sm font-semibold text-neutral-700">{card.score}</span>
          : <span className="text-xs text-neutral-300">—</span>}
      </div>
    </div>
  )
}

function Column({ col }: { col: BoardColumn }) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl bg-neutral-50 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-neutral-700">{col.title}</span>
        <span className="text-xs text-neutral-400">{col.cards.length}</span>
      </div>
      <div className="space-y-2">
        {col.cards.length === 0
          ? <div className="px-1 py-6 text-center text-xs text-neutral-300">Empty</div>
          : col.cards.map((c) => <Cardlet key={c.pipelineCandidateId} card={c} />)}
      </div>
    </div>
  )
}

/** Read-only progression board for a single pipeline: one column per round
 *  plus Selected / Not-advancing, each holding that round's candidate cards.
 *  Drag-to-advance, quick-advance criteria, and CSV export are Plan 4. */
export default function PipelineBoardPage() {
  const { id = '' } = useParams()
  const q = useQuery({ queryKey: ['pipeline-board', id], queryFn: () => pipelinesApi.board(id), enabled: !!id })

  if (q.isLoading) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-72" />
        <div className="flex gap-3 overflow-x-auto pb-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-72 shrink-0" />)}
        </div>
      </div>
    )
  }

  // Only a hard failure with NO data at all blocks the page (mirrors ReportPage).
  if (!q.data) {
    const reason = q.error instanceof Error ? q.error.message : 'Something went wrong while fetching it.'
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <Card className="p-0">
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertTriangle className="text-warning" size={24} />
            <p className="font-semibold text-neutral-700">Couldn’t load this pipeline</p>
            <p className="text-sm text-neutral-400">{reason}</p>
            <div className="flex items-center gap-3">
              <Button onClick={() => void q.refetch()}>Try again</Button>
              <Link to="/pipelines" className="text-sm font-medium text-primary-700">Back to pipelines</Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const board = q.data

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <Link to="/pipelines" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800">
        <ArrowLeft size={15} /> Pipelines
      </Link>
      <PageHeader
        kicker="Pipeline Board"
        title={board.pipeline.role}
        description={`${board.pipeline.rounds.length} round${board.pipeline.rounds.length === 1 ? '' : 's'} · candidate progression · read-only`}
      />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {board.columns.map((col) => <Column key={col.key} col={col} />)}
      </div>
    </div>
  )
}
