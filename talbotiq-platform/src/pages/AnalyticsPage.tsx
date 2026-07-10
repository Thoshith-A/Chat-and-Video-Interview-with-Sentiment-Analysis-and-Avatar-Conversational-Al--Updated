import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell,
} from 'recharts'
import { Card, StatCard, PageHeader, Select, Skeleton, EmptyState, Badge, SectionTitle, cn } from '@/components/ui'
import { analyticsApi, templatesApi } from '@/lib/api'
import type { AnalyticsFilters, TrackType } from '@shared/types'

const TOOLTIP = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }
const ACCENT = '#0d5c3a'
const TRACK_LABEL: Record<TrackType, string> = {
  chat: 'Timed Q&A', chatbot: 'Chatbot', voice: 'Voice', video_avatar: 'Video Avatar',
}
const REC_LABEL: Record<string, string> = {
  strong_yes: 'Strong Yes', yes: 'Yes', maybe: 'Maybe', no: 'No', unknown: 'Unscored',
}
const REC_COLOR: Record<string, string> = {
  strong_yes: '#0d5c3a', yes: '#16a34a', maybe: '#d97706', no: '#dc2626', unknown: '#94a3b8',
}
const bucketColor = (b: string) => (b === '81-100' ? '#0d5c3a' : b === '61-80' ? '#16a34a' : b === '41-60' ? '#d97706' : '#dc2626')
const pct = (n: number) => `${Math.round(n * 100)}%`
const mmss = (s: number) => (s > 0 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : '—')

export default function AnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({})
  const set = <K extends keyof AnalyticsFilters>(k: K, v: AnalyticsFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v || undefined }))

  const templates = useQuery({ queryKey: ['templates'], queryFn: templatesApi.list })
  const analytics = useQuery({ queryKey: ['analytics', filters], queryFn: () => analyticsApi.summary(filters) })

  const roles = useMemo(() => {
    const s = new Set<string>()
    for (const t of templates.data ?? []) if (t.role?.trim()) s.add(t.role.trim())
    return [...s].sort()
  }, [templates.data])

  const a = analytics.data
  const hasFilters = Object.values(filters).some(Boolean)

  const filterBar = (
    <div className="flex flex-wrap items-end gap-3">
      <Select label="Track" value={filters.track ?? ''} onChange={(e) => set('track', (e.target.value || undefined) as TrackType | undefined)}
        options={[{ value: '', label: 'All tracks' }, ...(Object.keys(TRACK_LABEL) as TrackType[]).map((t) => ({ value: t, label: TRACK_LABEL[t] }))]} />
      <Select label="Template" value={filters.templateId ?? ''} onChange={(e) => set('templateId', e.target.value || undefined)}
        options={[{ value: '', label: 'All templates' }, ...(templates.data ?? []).map((t) => ({ value: t.id, label: t.name }))]} />
      <Select label="Role" value={filters.role ?? ''} onChange={(e) => set('role', e.target.value || undefined)}
        options={[{ value: '', label: 'All roles' }, ...roles.map((r) => ({ value: r, label: r }))]} />
      <div className="flex flex-col gap-1.5">
        <label className="field-label">From</label>
        <input type="date" value={filters.dateFrom ?? ''} onChange={(e) => set('dateFrom', e.target.value || undefined)} className="input-base h-9 text-sm" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="field-label">To</label>
        <input type="date" value={filters.dateTo ?? ''} onChange={(e) => set('dateTo', e.target.value || undefined)} className="input-base h-9 text-sm" />
      </div>
      {hasFilters && (
        <button onClick={() => setFilters({})} className="h-9 px-3 rounded-lg text-sm font-medium text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100">
          Clear
        </button>
      )}
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHeader
        kicker="Platform Analytics"
        title="AI Interview Dashboard"
        description="Real metrics aggregated from scored interviews across the Chatbot, Voice, and Timed Q&A tracks."
      />

      <Card className="p-4 mb-6">{filterBar}</Card>

      {analytics.isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : analytics.isError ? (
        <Card className="p-0">
          <EmptyState icon="⚠️" title="Couldn’t load analytics" description="The analytics service returned an error. Try again in a moment." />
        </Card>
      ) : !a || a.totals.scored === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon="📊"
            title={hasFilters ? 'No scored interviews match these filters' : 'No scored interviews yet'}
            description={
              hasFilters
                ? 'Adjust or clear the filters above. Metrics appear once matching interviews are completed and scored.'
                : `${a?.totals.created ?? 0} session(s) created, ${a?.totals.completed ?? 0} completed. Numbers populate here as interviews finish and scoring completes.`
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Funnel / headline stats — all real */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Interviews Created" value={a.totals.created} sub={`${a.totals.started} started · ${a.totals.completed} completed`} color={ACCENT} />
            <StatCard label="Completion Rate" value={pct(a.completionRate)} sub={`${a.totals.completed} of ${a.totals.created}`} color={ACCENT} />
            <StatCard label="Average Score" value={a.averageOverall} sub={`across ${a.totals.scored} scored`} color="#d97706" />
            <StatCard label="Avg Duration" value={mmss(a.timeStats.avgDurationSeconds)} sub={`~${mmss(a.timeStats.avgTimePerQuestionSeconds)}/question`} color={ACCENT} />
          </div>

          {/* Score distribution + trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-5">
              <div className="mb-4"><p className="text-sm font-semibold text-neutral-800">Score Distribution</p><p className="text-xs text-neutral-400 mt-0.5">Overall scores, all scored interviews</p></div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={a.scoreDistribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" />
                  <XAxis dataKey="bucket" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {a.scoreDistribution.map((d) => <Cell key={d.bucket} fill={bucketColor(d.bucket)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <div className="mb-4"><p className="text-sm font-semibold text-neutral-800">Average Score Trend</p><p className="text-xs text-neutral-400 mt-0.5">By completion day</p></div>
              {a.trend.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-sm text-neutral-400">Not enough data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={a.trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={ACCENT} stopOpacity={0.14} /><stop offset="95%" stopColor={ACCENT} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(d: string) => d.slice(5)} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP} />
                    <Area type="monotone" dataKey="averageOverall" stroke={ACCENT} strokeWidth={2} fill="url(#scoreGrad)" dot={{ fill: ACCENT, r: 3, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* Per-KPI averages (by id, with coverage) */}
          <Card className="p-5">
            <SectionTitle>KPI Averages</SectionTitle>
            {a.kpiAverages.length === 0 ? (
              <p className="text-sm text-neutral-400">No KPI data.</p>
            ) : (
              <div className="space-y-3">
                {a.kpiAverages.map((k) => (
                  <div key={k.kpiId} className="flex items-center gap-3">
                    <span className="w-44 flex-shrink-0 truncate text-sm text-neutral-700" title={k.label}>{k.label}</span>
                    <div className="flex-1 h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${k.average}%`, background: k.average >= 75 ? '#16a34a' : k.average >= 55 ? '#d97706' : '#dc2626' }} />
                    </div>
                    <span className="w-9 text-right text-sm font-bold tabular-nums text-neutral-800">{k.average}</span>
                    <span className="w-24 text-right text-[11px] text-neutral-400" title="Share of scored interviews whose rubric included this KPI">{pct(k.coverage)} coverage</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Track comparison + recommendation distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-5">
              <SectionTitle>By Track</SectionTitle>
              <div className="space-y-2">
                {a.byTrack.map((t) => (
                  <div key={t.track} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <span className="w-28 flex-shrink-0 text-sm font-semibold text-neutral-800">{TRACK_LABEL[t.track]}</span>
                    <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                      <div><p className="text-lg font-bold text-neutral-900 tabular-nums">{t.count}</p><p className="text-[10px] uppercase tracking-wide text-neutral-400">sessions</p></div>
                      <div><p className="text-lg font-bold tabular-nums" style={{ color: ACCENT }}>{t.averageOverall || '—'}</p><p className="text-[10px] uppercase tracking-wide text-neutral-400">avg score</p></div>
                      <div><p className="text-lg font-bold text-neutral-900 tabular-nums">{pct(t.completionRate)}</p><p className="text-[10px] uppercase tracking-wide text-neutral-400">completion</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle>Recommendations</SectionTitle>
              <div className="space-y-2.5">
                {a.recommendationDistribution.length === 0 ? (
                  <p className="text-sm text-neutral-400">No recommendations yet.</p>
                ) : (
                  a.recommendationDistribution.map((r) => {
                    const total = a.recommendationDistribution.reduce((s, x) => s + x.count, 0)
                    const share = total ? r.count / total : 0
                    return (
                      <div key={r.recommendation} className="flex items-center gap-3">
                        <span className="w-24 flex-shrink-0 text-sm text-neutral-700">{REC_LABEL[r.recommendation] ?? r.recommendation}</span>
                        <div className="flex-1 h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.round(share * 100)}%`, background: REC_COLOR[r.recommendation] ?? '#94a3b8' }} />
                        </div>
                        <span className="w-8 text-right text-sm font-bold tabular-nums text-neutral-800">{r.count}</span>
                      </div>
                    )
                  })
                )}
                <div className="pt-2 mt-1 border-t border-border text-xs text-neutral-400">
                  Integrity flags on {pct(a.integrityFlagRate)} of scored interviews.
                </div>
              </div>
            </Card>
          </div>

          {/* By role + by template */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-5">
              <SectionTitle>By Role</SectionTitle>
              {a.byRole.length === 0 ? <p className="text-sm text-neutral-400">No role data.</p> : (
                <div className="space-y-2">
                  {a.byRole.map((r) => (
                    <div key={r.role} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <span className="truncate text-sm text-neutral-700">{r.role}</span>
                      <span className="flex items-center gap-4 flex-shrink-0">
                        <span className="text-xs text-neutral-400">{r.count} session{r.count !== 1 ? 's' : ''}</span>
                        <Badge variant={r.averageOverall >= 75 ? 'success' : r.averageOverall >= 55 ? 'warning' : 'neutral'}>{r.averageOverall || '—'}</Badge>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <SectionTitle>By Template</SectionTitle>
              {a.byTemplate.length === 0 ? <p className="text-sm text-neutral-400">No template data.</p> : (
                <div className="space-y-2">
                  {a.byTemplate.map((t) => (
                    <div key={t.templateId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <span className="truncate text-sm text-neutral-700" title={t.name}>{t.name}</span>
                      <span className="flex items-center gap-4 flex-shrink-0">
                        <span className="text-xs text-neutral-400">{t.count} session{t.count !== 1 ? 's' : ''}</span>
                        <Badge variant={t.averageOverall >= 75 ? 'success' : t.averageOverall >= 55 ? 'warning' : 'neutral'}>{t.averageOverall || '—'}</Badge>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Top candidates */}
          <Card className="p-5">
            <SectionTitle>Top Candidates</SectionTitle>
            {a.topCandidates.length === 0 ? <p className="text-sm text-neutral-400">No scored candidates yet.</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {a.topCandidates.map((c, i) => (
                  <Link key={c.sessionId} to={`/sessions/${c.sessionId}/report`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-50 transition-colors">
                    <span className={cn('w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0', i === 0 ? 'bg-primary-700 text-white' : 'bg-neutral-100 text-neutral-500')}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-800">{c.name}</span>
                      {c.role && <span className="block truncate text-xs text-neutral-400">{c.role}</span>}
                    </span>
                    <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: ACCENT }}>{c.overallScore}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <p className="text-center text-[11px] text-neutral-300">Aggregated {new Date(a.generatedAt).toLocaleString()} · scored interviews only</p>
        </div>
      )}
    </div>
  )
}
