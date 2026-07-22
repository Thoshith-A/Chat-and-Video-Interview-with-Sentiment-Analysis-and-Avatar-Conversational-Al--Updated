import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { pipelinesApi } from '@/lib/api'
import { Card, Select, PageHeader, EmptyState, Skeleton } from '@/components/ui'
import type { Pipeline } from '@shared/types'

export default function PipelinesPage() {
  const { data: pipelines, isLoading } = useQuery({ queryKey: ['pipelines'], queryFn: () => pipelinesApi.list() })
  const [role, setRole] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const roles = useMemo(
    () => [...new Set((pipelines ?? []).map((p) => p.role).filter(Boolean))].sort(),
    [pipelines],
  )
  const hasFilters = !!(role || from || to)
  const filtered = useMemo(() => (pipelines ?? []).filter((p) => {
    if (role && p.role !== role) return false
    if (from && (p.createdAt || '') < from) return false
    if (to && (p.createdAt || '') > `${to}T23:59:59.999Z`) return false
    return true
  }), [pipelines, role, from, to])

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <PageHeader
        kicker="Hiring Pipelines"
        title="Pipelines"
        description="Multi-round hiring flows. Pick one to see candidate progression."
      />

      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[{ value: '', label: 'All roles' }, ...roles.map((r) => ({ value: r, label: r }))]}
          />
          <div className="flex flex-col gap-1.5">
            <label className="field-label">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-base h-9 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-base h-9 text-sm" />
          </div>
          {hasFilters && (
            <button
              onClick={() => { setRole(''); setFrom(''); setTo('') }}
              className="h-9 px-3 rounded-lg text-sm font-medium text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
            >
              Clear
            </button>
          )}
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="🧬"
            title={hasFilters ? 'No pipelines match these filters' : 'No pipelines yet'}
            description="Create one from Sessions → Invite → Multiple Rounds."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p: Pipeline) => (
            <Link key={p.id} to={`/pipelines/${p.id}`}>
              <Card hover className="p-4">
                <div className="font-semibold text-neutral-800">{p.role}</div>
                <div className="text-sm text-neutral-500 mt-1">
                  {p.rounds.length} round{p.rounds.length === 1 ? '' : 's'} · {p.rounds.map((r) => r.name).join(' → ')}
                </div>
                <div className="mt-2 text-xs text-neutral-400">Created {new Date(p.createdAt).toLocaleDateString()}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
