/**
 * Shared invite-email helpers — the SINGLE source of truth for merge-variable
 * rendering, locked-token validation, AND the final email shell, used by BOTH the
 * client preview and the server send path so what the recruiter previews is exactly
 * what goes out.
 *
 * Pure + dependency-free (safe to import from client bundle and server). The server
 * sanitises the WYSIWYG body BEFORE calling renderInviteEmail(); the client passes
 * the editor's already-constrained HTML.
 */
import type { InviteEmailTemplate } from './types'

/** Merge variables the recruiter can insert. Filled per-candidate at send time. */
export const MERGE_VARS = [
  { token: '{{candidate_name}}', label: 'Candidate name' },
  { token: '{{role}}', label: 'Role' },
  { token: '{{recruiter_name}}', label: 'Recruiter name' },
  { token: '{{company}}', label: 'Company' },
  { token: '{{interview_link}}', label: 'Interview link (locked)' },
  { token: '{{deadline}}', label: 'Deadline' },
] as const

export type MergeVarKey =
  | 'candidate_name' | 'role' | 'recruiter_name' | 'company' | 'interview_link' | 'deadline'

/**
 * Tokens that MUST survive to send time. The interview link is functionally required
 * by the assigned-email auth model — every candidate needs their own unique link.
 */
export const REQUIRED_TOKENS = ['{{interview_link}}'] as const

/**
 * Replace `{{token}}` occurrences with values. Unknown tokens are left untouched
 * (so a typo shows up literally in the preview rather than silently vanishing).
 * Surrounding whitespace inside the braces is tolerated: `{{ role }}` === `{{role}}`.
 */
export function renderTemplate(str: string, vars: Record<string, string>): string {
  if (!str) return ''
  return str.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? '') : m,
  )
}

/** True when a merge token is present anywhere in subject or body. */
export function validateLockedTokens(
  subject: string,
  bodyHtml: string,
): { ok: boolean; missing: string[] } {
  const hay = `${subject ?? ''}\n${bodyHtml ?? ''}`
  const missing = REQUIRED_TOKENS.filter((t) => !hay.includes(t))
  return { ok: missing.length === 0, missing }
}

/** Any `{{tokens}}` in the string that are NOT recognised merge variables. */
export function unknownTokens(str: string): string[] {
  const known = new Set<string>(MERGE_VARS.map((v) => v.token))
  const found = str.match(/\{\{\s*[a-z_]+\s*\}\}/g) ?? []
  return [...new Set(found.map((f) => f.replace(/\s+/g, '')))].filter((t) => !known.has(t))
}

/** HTML-escape a text value so merge/candidate text can't inject markup. */
export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const HEX = /^#[0-9a-f]{3,8}$/i

export interface InviteRenderVars {
  candidate_name: string
  role: string
  recruiter_name: string
  company: string
  deadline: string
}
export interface InviteRenderOpts {
  interviewLink: string
  candidateEmail: string
}

function ctaButton(tpl: InviteEmailTemplate, link: string): string {
  const color = HEX.test(tpl.cta?.color || '') ? tpl.cta.color : '#0d5c3a'
  const text = escapeHtml(tpl.cta?.text || 'Start your interview')
  return `<a href="${escapeHtml(link)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-family:Inter,Arial,sans-serif">${text}</a>`
}

/** The locked "use this exact email" note — always present, never removable. */
export function exactEmailNote(candidateEmail: string): string {
  return `<p style="background:#f0faf5;border:1px solid #dcf5e8;border-radius:8px;padding:10px 14px;color:#0a4a2e;font-size:13px;font-family:Inter,Arial,sans-serif">
    <strong>Important:</strong> this invitation is linked to <strong>${escapeHtml(candidateEmail)}</strong>.
    Sign in — or create your candidate account — using this exact email address to open it.
  </p>`
}

/**
 * Build the final { subject, html } for one candidate. `bodyHtml` on the template is
 * assumed SAFE (server sanitises first; the client editor is already constrained).
 * The `{{interview_link}}` token in the body becomes the CTA button; all other
 * tokens are escaped text. The locked link + "exact email" note are always injected.
 */
export function renderInviteEmail(
  tpl: InviteEmailTemplate,
  vars: InviteRenderVars,
  opts: InviteRenderOpts,
): { subject: string; html: string } {
  const textVars: Record<string, string> = {
    candidate_name: escapeHtml(vars.candidate_name),
    role: escapeHtml(vars.role),
    recruiter_name: escapeHtml(vars.recruiter_name),
    company: escapeHtml(vars.company),
    deadline: escapeHtml(vars.deadline),
  }

  const subject = renderTemplate(tpl.subject, { ...textVars, interview_link: opts.interviewLink })

  const bodyHasLink = (tpl.bodyHtml || '').includes('{{interview_link}}')
  const bodyRendered = renderTemplate(tpl.bodyHtml || '', {
    ...textVars,
    interview_link: ctaButton(tpl, opts.interviewLink),
  })
  const fallbackCta = bodyHasLink ? '' : `<p style="margin:16px 0">${ctaButton(tpl, opts.interviewLink)}</p>`

  const accent = HEX.test(tpl.branding?.accentColor || '') ? tpl.branding.accentColor : '#0d5c3a'
  const logo = tpl.branding?.logoUrl
    ? `<img src="${escapeHtml(tpl.branding.logoUrl)}" alt="${escapeHtml(tpl.branding.companyName || '')}" style="max-height:40px;margin-bottom:8px" />`
    : `<div style="font-weight:700;color:${accent};font-size:18px">${escapeHtml(tpl.branding?.companyName || 'TalbotIQ')}</div>`
  const footer = escapeHtml(tpl.branding?.footer || 'Sent via TalbotIQ.')

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff5f0;padding:24px 0;font-family:Inter,Arial,sans-serif">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dde8e0;border-radius:16px;overflow:hidden">
      <tr><td style="border-top:4px solid ${accent};padding:20px 28px 8px">${logo}</td></tr>
      <tr><td style="padding:8px 28px;color:#0f172a;font-size:15px;line-height:1.6">
        ${bodyRendered}
        ${fallbackCta}
        ${exactEmailNote(opts.candidateEmail)}
        <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br>${escapeHtml(opts.interviewLink)}</p>
      </td></tr>
      <tr><td style="padding:14px 28px 22px;color:#94a3b8;font-size:12px;border-top:1px solid #dde8e0">${footer}</td></tr>
    </table>
  </td></tr>
</table>`

  return { subject, html }
}

/**
 * A sensible default invite-email config that preloads for a recruiter who has none.
 * Passes locked-token validation. Caller stamps id/recruiterId/timestamps.
 */
export function defaultInviteEmailTemplate() {
  return {
    name: 'Default invite',
    isDefault: true,
    sender: { verifiedSenderEmail: '', fromName: 'TalbotIQ', replyTo: '' },
    subject: 'Interview invitation — {{role}}',
    bodyHtml:
      '<p>Hi {{candidate_name}},</p>' +
      '<p><strong>{{recruiter_name}}</strong> has invited you to a screening interview for the <strong>{{role}}</strong> role at {{company}}.</p>' +
      "<p>When you're ready, open your interview, upload your résumé, and begin — it takes just a few minutes:</p>" +
      '<p>{{interview_link}}</p>',
    cta: { text: 'Start your interview', color: '#0d5c3a' },
    branding: {
      companyName: 'TalbotIQ',
      accentColor: '#0d5c3a',
      footer: 'Sent via TalbotIQ.',
    } as { companyName: string; accentColor: string; footer?: string; logoUrl?: string },
    deadlineText: '',
  }
}
