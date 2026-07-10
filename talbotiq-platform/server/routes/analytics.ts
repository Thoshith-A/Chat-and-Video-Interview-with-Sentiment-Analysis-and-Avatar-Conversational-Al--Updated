import { Router } from 'express'
import { computeAnalytics } from '../services/analytics'
import type { AnalyticsFilters, TrackType } from '../../shared/types'

export const analyticsRouter = Router()

const TRACKS: TrackType[] = ['chat', 'chatbot', 'video_avatar', 'voice']
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

// GET /api/analytics — real aggregates over stored ResultReports. All filters
// optional. No matches → zeros + empty arrays (never fabricated data).
analyticsRouter.get('/', (req, res) => {
  const q = req.query
  const track = str(q.track)
  const filters: AnalyticsFilters = {
    track: track && (TRACKS as string[]).includes(track) ? (track as TrackType) : undefined,
    templateId: str(q.templateId),
    role: str(q.role),
    dateFrom: str(q.dateFrom),
    dateTo: str(q.dateTo),
  }
  res.json(computeAnalytics(filters))
})
