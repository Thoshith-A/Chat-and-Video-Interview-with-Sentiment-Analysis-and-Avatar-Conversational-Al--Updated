/**
 * Mimic marketing site — information architecture + page content.
 *
 * Single source of truth for the nav mega-menu, the footer, the route table and
 * every page's copy + SEO. Templates render from this, so every nav link resolves
 * to a real, populated, indexable page (zero dead ends) and the nav/footer are
 * generated once. Content is written to be honest and specific; anything we cannot
 * truthfully assert (certifications, customers, metrics we don't have) is a
 * [PLACEHOLDER] string, surfaced to the team, never fabricated.
 */

export interface NavLink { label: string; to: string }
export interface NavColumn { title: string; links: NavLink[] }
export interface NavGroup { key: string; label: string; to: string; columns: NavColumn[] }

export interface PageSection { h2: string; body: string; bullets?: string[] }
export interface FaqItem { q: string; a: string }
export interface MktPage {
  slug: string            // path under /mimic, e.g. "solutions/high-volume-hiring"
  section: string         // "Solutions" | "Trust" | ...
  sectionTo: string       // hub route, e.g. "/mimic/solutions"
  tier: 'hub' | 'A' | 'B' | 'C'
  kicker: string
  h1: string
  metaTitle: string       // ~55-60 chars
  metaDesc: string        // ~150-160 chars
  intro: string
  sections: PageSection[]
  faqs?: FaqItem[]
  cta?: { title: string; sub: string }
}

const DEMO = '/mimic#demo'

/* ─── Nav tree (drives mega-menu + footer + routes) ───────────────────────── */
export const NAV: NavGroup[] = [
  {
    key: 'Platform', label: 'Platform', to: '/mimic#platform',
    columns: [
      { title: 'Interview tracks', links: [
        { label: 'Conversational chat', to: '/mimic#platform' },
        { label: 'Voice screening', to: '/mimic#platform' },
        { label: 'AI video avatar', to: '/mimic#platform' },
        { label: 'Live two-way call', to: '/mimic#platform' },
        { label: 'Timed Q&A', to: '/mimic#platform' },
      ]},
      { title: 'Workflow', links: [
        { label: 'Bulk invitations', to: '/mimic#process' },
        { label: 'Interview templates', to: '/mimic#process' },
        { label: 'Question sets', to: '/mimic#process' },
        { label: 'Multi-round pipelines', to: '/mimic#process' },
        { label: 'Rubrics & scoring', to: '/mimic#how' },
      ]},
      { title: 'Intelligence', links: [
        { label: 'Candidate reports', to: '/mimic#how' },
        { label: 'Recruiter analytics', to: '/mimic#how' },
        { label: 'Signal analysis', to: '/mimic#platform' },
        { label: 'Mimic Guide assistant', to: '/mimic#platform' },
      ]},
    ],
  },
  {
    key: 'Solutions', label: 'Solutions', to: '/mimic/solutions',
    columns: [
      { title: 'By use case', links: [
        { label: 'High-volume hiring', to: '/mimic/solutions/high-volume-hiring' },
        { label: 'Campus & graduate', to: '/mimic/solutions/campus-graduate' },
        { label: 'Technical screening', to: '/mimic/solutions/technical-screening' },
        { label: 'Sales & customer-facing', to: '/mimic/solutions/sales-customer-facing' },
        { label: 'Frontline & hourly', to: '/mimic/solutions/frontline-hourly' },
        { label: 'Internal mobility', to: '/mimic/solutions/internal-mobility' },
      ]},
      { title: 'By team', links: [
        { label: 'Talent acquisition leaders', to: '/mimic/solutions/talent-acquisition-leaders' },
        { label: 'Recruiters', to: '/mimic/solutions/recruiters' },
        { label: 'Hiring managers', to: '/mimic/solutions/hiring-managers' },
        { label: 'RPO & staffing agencies', to: '/mimic/solutions/rpo-staffing' },
        { label: 'People analytics', to: '/mimic/solutions/people-analytics' },
      ]},
      { title: 'By industry', links: [
        { label: 'BPO & contact centres', to: '/mimic/solutions/bpo-contact-centres' },
        { label: 'IT services', to: '/mimic/solutions/it-services' },
        { label: 'Retail & hospitality', to: '/mimic/solutions/retail-hospitality' },
        { label: 'Healthcare', to: '/mimic/solutions/healthcare' },
        { label: 'Financial services', to: '/mimic/solutions/financial-services' },
      ]},
    ],
  },
  {
    key: 'Trust', label: 'Trust', to: '/mimic/trust',
    columns: [
      { title: 'Responsible AI', links: [
        { label: 'How Mimic scores', to: '/mimic/trust/how-mimic-scores' },
        { label: 'Bias testing & audits', to: '/mimic/trust/bias-testing-audits' },
        { label: 'Human-in-the-loop review', to: '/mimic/trust/human-in-the-loop' },
        { label: 'Model & data transparency', to: '/mimic/trust/model-data-transparency' },
        { label: 'Candidate rights', to: '/mimic/trust/candidate-rights' },
      ]},
      { title: 'Compliance', links: [
        { label: 'EU AI Act', to: '/mimic/trust/eu-ai-act' },
        { label: 'NYC Local Law 144', to: '/mimic/trust/nyc-local-law-144' },
        { label: 'Illinois AI Video Interview Act', to: '/mimic/trust/illinois-aivia' },
        { label: 'GDPR & India DPDP', to: '/mimic/trust/gdpr-india-dpdp' },
        { label: 'EEOC & adverse impact', to: '/mimic/trust/eeoc-adverse-impact' },
      ]},
      { title: 'Security', links: [
        { label: 'Trust Center', to: '/mimic/trust/trust-center' },
        { label: 'Certifications', to: '/mimic/trust/certifications' },
        { label: 'Data residency & retention', to: '/mimic/trust/data-residency-retention' },
        { label: 'Sub-processors', to: '/mimic/trust/sub-processors' },
        { label: 'Status page', to: '/mimic/trust/status' },
      ]},
    ],
  },
  {
    key: 'Resources', label: 'Resources', to: '/mimic/resources',
    columns: [
      { title: 'Learn', links: [
        { label: 'Blog', to: '/mimic/resources' },
        { label: 'Guides & playbooks', to: '/mimic/resources' },
        { label: 'Webinars', to: '/mimic/resources' },
        { label: 'Interview question library', to: '/mimic/resources' },
        { label: 'Rubric templates', to: '/mimic/resources' },
        { label: 'Glossary', to: '/mimic/resources' },
      ]},
      { title: 'Proof', links: [
        { label: 'Customer stories', to: '/mimic/resources' },
        { label: 'ROI calculator', to: '/mimic/resources' },
        { label: 'Benchmark report', to: '/mimic/resources' },
      ]},
      { title: 'Build', links: [
        { label: 'Documentation', to: '/mimic/resources' },
        { label: 'API reference', to: '/mimic/resources' },
        { label: 'ATS integrations', to: '/mimic/resources' },
        { label: 'Changelog', to: '/mimic/resources' },
        { label: 'Help centre', to: '/mimic/resources' },
      ]},
    ],
  },
  {
    key: 'Company', label: 'Company', to: '/mimic/company',
    columns: [
      { title: 'About', links: [
        { label: 'About TalbotIQ', to: '/mimic/company' },
        { label: 'Careers', to: '/mimic/company' },
        { label: 'Newsroom', to: '/mimic/company' },
        { label: 'Contact', to: '/mimic/company' },
      ]},
      { title: 'Connect', links: [
        { label: 'Partners', to: '/mimic/company' },
        { label: 'Become a reseller', to: '/mimic/company' },
        { label: 'Events', to: '/mimic/company' },
        { label: 'Legal & privacy', to: '/mimic/company' },
      ]},
    ],
  },
]

/* ─── Section hubs (real overview pages so every top-level item resolves) ──── */
const HUBS: MktPage[] = [
  {
    slug: 'solutions', section: 'Solutions', sectionTo: '/mimic/solutions', tier: 'hub',
    kicker: 'Solutions', h1: 'The right screen for every kind of hire.',
    metaTitle: 'Mimic Solutions — AI screening by use case & team',
    metaDesc: 'See how Mimic screens candidates for high-volume, campus, technical and frontline hiring — and what changes for recruiters, hiring managers and RPOs.',
    intro: 'Mimic is one platform, but the job it does looks different depending on who you are hiring and who is doing the hiring. Start with the use case closest to yours.',
    sections: [
      { h2: 'By use case', body: 'The shape of the problem changes with volume, seniority and format.', bullets: ['High-volume hiring', 'Campus & graduate', 'Technical screening', 'Sales & customer-facing', 'Frontline & hourly', 'Internal mobility'] },
      { h2: 'By team', body: 'What Mimic returns to your week depends on your seat.', bullets: ['Talent acquisition leaders', 'Recruiters', 'Hiring managers', 'RPO & staffing agencies', 'People analytics'] },
      { h2: 'By industry', body: 'Rubrics and question sets tuned to how your industry actually interviews.', bullets: ['BPO & contact centres', 'IT services', 'Retail & hospitality', 'Healthcare', 'Financial services'] },
    ],
    cta: { title: 'See Mimic on your roles', sub: 'Book a 30-minute walkthrough on your own open reqs.' },
  },
  {
    slug: 'trust', section: 'Trust', sectionTo: '/mimic/trust', tier: 'hub',
    kicker: 'Trust', h1: 'AI hiring your legal team can actually sign off.',
    metaTitle: 'Mimic Trust — responsible AI, compliance & security',
    metaDesc: 'How Mimic scores, how bias is tested, how humans stay in the loop, and how we map to the EU AI Act, NYC Local Law 144, Illinois AIVIA, GDPR and EEOC.',
    intro: 'In AI hiring, the deal-blocker is rarely price — it is the security, legal and DEI review. This section answers those questions directly, before they land in your procurement queue.',
    sections: [
      { h2: 'Responsible AI', body: 'How scoring works, how we test for adverse impact, and where a human decides.', bullets: ['How Mimic scores', 'Bias testing & audits', 'Human-in-the-loop review', 'Model & data transparency', 'Candidate rights'] },
      { h2: 'Compliance', body: 'How Mimic maps to the regulations your review will raise.', bullets: ['EU AI Act', 'NYC Local Law 144', 'Illinois AI Video Interview Act', 'GDPR & India DPDP', 'EEOC & adverse impact'] },
      { h2: 'Security', body: 'Where your data lives, who touches it, and how long it is kept.', bullets: ['Trust Center', 'Certifications', 'Data residency & retention', 'Sub-processors', 'Status page'] },
    ],
    cta: { title: 'Talk to our security team', sub: 'We will walk your legal and infosec reviewers through the controls.' },
  },
  {
    slug: 'resources', section: 'Resources', sectionTo: '/mimic/resources', tier: 'hub',
    kicker: 'Resources', h1: 'Learn how the best teams screen at volume.',
    metaTitle: 'Mimic Resources — guides, docs & customer proof',
    metaDesc: 'Playbooks, an interview question library, rubric templates, docs and an API reference — everything to run structured, fair AI screening well.',
    intro: 'Practical material for the people who run screening day to day — and the developers who wire Mimic into your stack.',
    sections: [
      { h2: 'Learn', body: 'Field-tested playbooks and reference material.', bullets: ['Blog', 'Guides & playbooks', 'Webinars', 'Interview question library', 'Rubric templates', 'Glossary'] },
      { h2: 'Proof', body: 'What Mimic changes, in numbers and in stories.', bullets: ['Customer stories', 'ROI calculator', 'Benchmark report'] },
      { h2: 'Build', body: 'For developers and RevOps wiring Mimic into your ATS.', bullets: ['Documentation', 'API reference', 'ATS integrations', 'Changelog', 'Help centre'] },
    ],
    cta: { title: 'Get the screening playbook', sub: 'Book a demo and we will share the material relevant to your team.' },
  },
  {
    slug: 'company', section: 'Company', sectionTo: '/mimic/company', tier: 'hub',
    kicker: 'Company', h1: 'Mimic is built by TalbotIQ.',
    metaTitle: 'Company — Mimic by TalbotIQ',
    metaDesc: 'Who builds Mimic, what we believe about fair AI hiring, and how to reach us for partnerships, press, careers and support.',
    intro: 'Mimic is the AI-interview product from TalbotIQ. We build screening that measures every candidate the same way and keeps a human on every decision.',
    sections: [
      { h2: 'About', body: 'Who we are and how to reach us.', bullets: ['About TalbotIQ', 'Careers', 'Newsroom', 'Contact'] },
      { h2: 'Connect', body: 'Work with us.', bullets: ['Partners', 'Become a reseller', 'Events', 'Legal & privacy'] },
    ],
    cta: { title: 'Talk to us', sub: 'Sales, partnerships or press — we will route you to the right person.' },
  },
]

/* ─── Solutions detail pages (Tier A/B) ────────────────────────────────────── */
function solution(slug: string, kicker: string, h1: string, metaTitle: string, metaDesc: string, intro: string, sections: PageSection[], faqs: FaqItem[]): MktPage {
  return { slug: `solutions/${slug}`, section: 'Solutions', sectionTo: '/mimic/solutions', tier: 'A', kicker, h1, metaTitle, metaDesc, intro, sections, faqs, cta: { title: 'See it on your roles', sub: 'A 30-minute walkthrough on your own open reqs — no card required.' } }
}

const SOLUTION_PAGES: MktPage[] = [
  solution('high-volume-hiring', 'Use case · High-volume hiring',
    'Interview 5,000 applicants without adding a single recruiter.',
    'High-Volume Hiring Software | Mimic by TalbotIQ',
    'Screen thousands of applicants the day they apply. Mimic interviews and scores every candidate on one rubric so your team reviews a shortlist, not a queue.',
    'When a req draws hundreds of applicants, the first round becomes a staffing problem: someone has to talk to everyone, and nobody has the hours. So résumés get keyword-filtered, good people fall through, and time-to-fill stretches for weeks.',
    [
      { h2: 'The problem with a phone-screen queue', body: 'Manual first-round screening does not scale linearly — it scales with headcount you do not have. Every day a candidate waits is a day a competitor calls them first.' },
      { h2: 'How Mimic handles volume', body: 'Every applicant is invited automatically and interviews on their own schedule, on a phone if that is what they have. Answers are scored against one rubric with the evidence attached.', bullets: ['Bulk-invite from a CSV, ATS export, or one link', 'Async chat, voice or video — no scheduling', 'One rubric, so 5,000 scores compare directly'] },
      { h2: 'What changes for your team', body: 'Recruiters stop being the bottleneck and start working a ranked shortlist. Hiring managers see evidence, not just a résumé.' },
    ],
    [
      { q: 'Does volume slow scoring down?', a: 'No — interviews are scored as they complete, around the clock, so your shortlist keeps filling whether it is 50 applicants or 5,000.' },
      { q: 'What about candidate experience at scale?', a: 'Candidates interview when it suits them and get a consistent, structured experience instead of waiting weeks for a callback.' },
    ]),
  solution('campus-graduate', 'Use case · Campus & graduate',
    'Give every graduate applicant a fair first interview.',
    'Campus & Graduate Recruiting Software | Mimic',
    'Interview an entire graduate cohort in days, not months. Résumé-adaptive questions and one rubric mean every student gets the same fair shot.',
    'Campus hiring compresses a year of applications into a few frantic weeks. Volume spikes, résumés look identical, and the students you want have three other offers by the time you schedule a call.',
    [
      { h2: 'Why graduate volume breaks manual screening', body: 'Thousands of near-identical résumés arrive in the same fortnight. Keyword filters cut good people; scheduling cannot keep pace.' },
      { h2: 'How Mimic runs a cohort', body: 'Invite the whole cohort at once. Each interview reads the student’s résumé and asks about what they actually did, not a generic “tell me about yourself”.', bullets: ['Same-day interviews for the whole cohort', 'Résumé-adaptive questions per student', 'Structured scores career services can defend'] },
      { h2: 'What changes', body: 'You reach strong students before your competitors, and every applicant gets a real, fair interview instead of a silent rejection.' },
    ],
    [{ q: 'Can we share results with a university?', a: 'You can export structured, evidence-backed scores — useful for career-services partnerships. [PLACEHOLDER: confirm cohort-export details]' }]),
  solution('technical-screening', 'Use case · Technical screening',
    'Screen for real skill before an engineer’s calendar gets involved.',
    'Technical Screening Software | Mimic by TalbotIQ',
    'Résumé-adaptive technical interviews that probe depth, not buzzwords — scored on one rubric so your engineers only meet candidates worth their time.',
    'Engineering interview time is your scarcest resource, and most of it is spent on candidates who will not pass. The first technical screen is where that waste starts.',
    [
      { h2: 'The cost of a shallow first screen', body: 'Keyword-matched résumés put unqualified candidates in front of senior engineers, burning the exact hours you are trying to protect.' },
      { h2: 'How Mimic screens for depth', body: 'Interviews adapt to what the résumé claims and follow up when an answer is thin — with per-question timers for skills that need pressure.', bullets: ['Résumé-adaptive follow-ups', 'Timed Q&A for pressure-testing', 'Evidence-cited scores per dimension'] },
      { h2: 'What changes for engineering', body: 'Your engineers meet a short, strong list, and every candidate is measured against the same bar.' },
    ],
    [{ q: 'Is this a coding test?', a: 'Mimic focuses on structured technical conversation and reasoning; pair it with your existing coding assessment rather than replacing it. [PLACEHOLDER: confirm coding-assessment integrations]' }]),
  solution('sales-customer-facing', 'Use case · Sales & customer-facing',
    'Hear how a candidate actually sells — before you book the panel.',
    'Sales Hiring & Screening Software | Mimic',
    'Voice and video interviews that surface communication, objection handling and presence — scored consistently so your best closers reach the shortlist.',
    'For sales and customer-facing roles, the résumé tells you almost nothing that matters. How someone communicates under a little pressure is the job — and you cannot read it off a CV.',
    [
      { h2: 'Why résumés fail sales hiring', body: 'Quota history is noisy and hard to verify; the signal you need is live communication, which manual screening only reaches after weeks of scheduling.' },
      { h2: 'How Mimic surfaces the signal', body: 'Voice and video tracks assess tone, pacing and content together, with the same rubric applied to every candidate.', bullets: ['Voice & video screening', 'Signal analysis on delivery', 'Consistent rubric across candidates'] },
      { h2: 'What changes', body: 'Managers hear real communication early and spend panel time only on candidates who can actually carry a conversation.' },
    ],
    [{ q: 'Can we score for specific competencies?', a: 'Yes — build a rubric around the competencies that matter for the role (discovery, objection handling, clarity) and Mimic scores every candidate against it.' }]),
  solution('frontline-hourly', 'Use case · Frontline & hourly',
    'Fill frontline roles before the applicant takes another job.',
    'Frontline & Hourly Hiring Software | Mimic',
    'Mobile-first chat interviews that hourly candidates finish in minutes — so you screen and shortlist the same day applications arrive.',
    'Frontline hiring is a race. Hourly candidates apply to several employers at once and take the first real offer. A screening process measured in days loses them to one measured in hours.',
    [
      { h2: 'Speed is the whole game', body: 'Every day in the queue is a candidate lost to a faster employer. Manual screening cannot move at frontline speed.' },
      { h2: 'How Mimic moves same-day', body: 'A text interview candidates finish on a phone in minutes, scored instantly so you can reach out while they are still interested.', bullets: ['Mobile-first, no scheduling', 'Finishes in minutes', 'Instant, consistent scoring'] },
      { h2: 'What changes', body: 'You contact strong candidates first, and location managers get a ready shortlist instead of a stack of applications.' },
    ],
    [{ q: 'Do candidates need an app or account?', a: 'No — they open a link and interview in the browser on their phone.' }]),
  solution('internal-mobility', 'Use case · Internal mobility',
    'Give internal candidates the same fair, structured shot.',
    'Internal Mobility & Talent Screening | Mimic',
    'Screen internal applicants against the same rubric as external ones — a defensible, consistent process that helps people grow without favouritism.',
    'Internal mobility often runs on hallway conversations and manager relationships. That is how good internal candidates get overlooked and how bias claims start.',
    [
      { h2: 'The risk of informal internal hiring', body: 'Inconsistent, undocumented internal processes are hard to defend and easy to skew toward whoever is most visible.' },
      { h2: 'How Mimic standardises it', body: 'Internal applicants take the same structured interview and are scored on the same rubric, with the evidence recorded.', bullets: ['Same rubric as external candidates', 'Documented, defensible decisions', 'A real shot for quieter high-performers'] },
      { h2: 'What changes', body: 'People see a fair path to grow, and HR has a record that stands up to scrutiny.' },
    ],
    [{ q: 'Can managers still weigh in?', a: 'Yes — scores are recommendations with evidence; the hiring manager still decides, now with a consistent baseline.' }]),
]

/* ─── Solutions "by team" + "by industry" (Tier B — real, tighter pages) ───── */
function brief(slug: string, kicker: string, h1: string, metaTitle: string, metaDesc: string, intro: string, sections: PageSection[]): MktPage {
  return { slug: `solutions/${slug}`, section: 'Solutions', sectionTo: '/mimic/solutions', tier: 'B', kicker, h1, metaTitle, metaDesc, intro, sections, cta: { title: 'See it on your roles', sub: 'Book a 30-minute walkthrough on your own open reqs.' } }
}
const SOLUTION_BRIEFS: MktPage[] = [
  brief('talent-acquisition-leaders', 'Team · TA leaders', 'Cut time-to-fill without cutting corners on fairness.', 'For Talent Acquisition Leaders | Mimic', 'Give your TA org capacity and a defensible, consistent screening process — with analytics by role, team and recruiter.', 'You are asked to hire faster, cheaper and more fairly at the same time. Mimic gives your team first-round capacity back and gives you the analytics to prove the process is consistent.', [ { h2: 'What you get', body: 'Capacity, consistency and evidence.', bullets: ['First round runs itself, at any volume', 'One rubric across every recruiter and track', 'Analytics by role, template, track and recruiter'] } ]),
  brief('recruiters', 'Team · Recruiters', 'Stop phone-screening. Start working a shortlist.', 'For Recruiters | Mimic by TalbotIQ', 'Mimic runs your first round so you spend your day on the candidates most worth your time — with evidence for every score.', 'The first round is the least strategic part of your week and the biggest time sink. Mimic takes it off your plate and hands you a ranked, evidence-backed shortlist.', [ { h2: 'What changes for you', body: 'Less scheduling, more judgement.', bullets: ['No calendar tetris for first rounds', 'Evidence behind every score', 'More time on offers and candidate care'] } ]),
  brief('hiring-managers', 'Team · Hiring managers', 'Meet a short list of people actually worth your time.', 'For Hiring Managers | Mimic', 'See evidence-backed scores, not just résumés, so your interview time goes to candidates who can do the job.', 'You do not have time to interview a long list, and a résumé does not tell you who can do the work. Mimic gives you a short list with the evidence behind each score.', [ { h2: 'What you get', body: 'Signal before you spend an hour.', bullets: ['Ranked shortlist with evidence', 'Per-question breakdowns', 'A consistent bar across candidates'] } ]),
  brief('rpo-staffing', 'Team · RPO & staffing', 'Screen more roles per recruiter, across every client.', 'RPO & Staffing Agency Screening | Mimic', 'Run structured, branded screening at agency scale — more submittals per recruiter, consistent quality across every client account.', 'Your margin is recruiter time. Manual first rounds cap how many roles each recruiter can carry and make quality uneven across clients.', [ { h2: 'What changes for your agency', body: 'More throughput, consistent quality.', bullets: ['More roles per recruiter', 'Consistent quality across accounts', 'Client-ready, evidence-backed submittals'] } ]),
  brief('people-analytics', 'Team · People analytics', 'Screening data you can actually analyse.', 'People Analytics for Hiring | Mimic', 'Every candidate scored on one rubric with the evidence recorded — structured hiring data by role, template, track and recruiter.', 'Most screening produces no usable data — just notes in inboxes. Mimic produces structured, comparable scores you can analyse and defend.', [ { h2: 'What you get', body: 'Clean, comparable hiring data.', bullets: ['One rubric = comparable scores', 'Adverse-impact reporting per dimension', 'Exportable, auditable records'] } ]),
  brief('bpo-contact-centres', 'Industry · BPO & contact centres', 'Screen contact-centre agents at the speed you lose them.', 'BPO & Contact Centre Hiring | Mimic', 'Voice-first, mobile screening for high-attrition contact-centre roles — assess communication and score consistently, same day.', 'Contact-centre hiring is high-volume and high-attrition: you are always hiring, and speed plus communication signal are everything.', [ { h2: 'Why Mimic fits BPO', body: 'Volume, speed and the right signal.', bullets: ['Voice screening for comms signal', 'Same-day, mobile-first', 'Scales to constant req volume'] } ]),
  brief('it-services', 'Industry · IT services', 'Bench-ready technical screening at project speed.', 'IT Services Hiring & Screening | Mimic', 'Résumé-adaptive technical interviews to staff projects fast without burning senior engineers on unqualified first rounds.', 'IT services hiring is bursty and skill-specific — you need qualified people bench-ready when a project lands, without wasting senior engineers on screening.', [ { h2: 'Why Mimic fits IT services', body: 'Depth, fast.', bullets: ['Résumé-adaptive technical screens', 'Scales with project demand', 'Protects senior-engineer time'] } ]),
  brief('retail-hospitality', 'Industry · Retail & hospitality', 'Staff every location before the season peaks.', 'Retail & Hospitality Hiring | Mimic', 'Mobile-first, same-day screening for seasonal and frontline retail and hospitality roles across every location.', 'Retail and hospitality hiring spikes with the season and spans many locations. Speed and a consistent bar across sites are what you need.', [ { h2: 'Why Mimic fits retail', body: 'Fast, consistent, everywhere.', bullets: ['Same-day mobile screening', 'Consistent bar across locations', 'Handles seasonal spikes'] } ]),
  brief('healthcare', 'Industry · Healthcare', 'Screen clinical staff against a defensible rubric.', 'Healthcare Hiring & Screening | Mimic', 'Structured screening for clinical and support roles — consistent, evidence-backed, and built for shift-based, high-demand hiring.', 'Healthcare hiring is high-stakes and heavily scrutinised: you need a consistent, defensible process that still moves fast enough to fill shifts.', [ { h2: 'Why Mimic fits healthcare', body: 'Consistent and defensible.', bullets: ['Rubrics tuned to clinical roles', 'Evidence-backed, auditable scores', 'Handles shift-based volume'] } ]),
  brief('financial-services', 'Industry · Financial services', 'Screen at scale with an audit trail regulators accept.', 'Financial Services Hiring | Mimic', 'Consistent, evidence-backed screening with the audit trail and controls financial-services compliance teams expect.', 'Financial-services hiring runs under real regulatory and audit scrutiny. Every screening decision needs to be consistent, evidenced and defensible.', [ { h2: 'Why Mimic fits financial services', body: 'Scale with an audit trail.', bullets: ['One rubric, fully evidenced', 'Adverse-impact reporting', 'Auditable decision records'] } ]),
]

/* ─── Trust pages ──────────────────────────────────────────────────────────
 * Legal is the deal-blocker in AI hiring, so these describe capabilities and
 * controls FACTUALLY and never assert an attestation, certification or legal
 * compliance we cannot prove — those are [PLACEHOLDER] for the team to confirm.
 * Compliance pages explain how Mimic supports a regulation; they are not legal
 * advice. */
function trust(slug: string, tier: 'A' | 'B', kicker: string, h1: string, metaTitle: string, metaDesc: string, intro: string, sections: PageSection[], faqs?: FaqItem[]): MktPage {
  return { slug: `trust/${slug}`, section: 'Trust', sectionTo: '/mimic/trust', tier, kicker, h1, metaTitle, metaDesc, intro, sections, faqs, cta: { title: 'Talk to our security team', sub: 'We will walk your legal and infosec reviewers through the controls.' } }
}
const TRUST_PAGES: MktPage[] = [
  trust('how-mimic-scores', 'A', 'Responsible AI · Scoring', 'See exactly how every score is reached.',
    'How Mimic Scores Candidates | Responsible AI',
    'A Mimic score is a recommendation with the evidence attached — measured against the rubric you set, dimension by dimension. Here is precisely how it works.',
    'A score you cannot explain is a score your legal team will not accept. Mimic is built so every number traces back to a specific answer and a rubric you defined.',
    [
      { h2: 'A score is a recommendation, not a verdict', body: 'Mimic produces a recommendation with evidence. A human reviews it and decides. Nothing is auto-rejected.' },
      { h2: 'You set the rubric', body: 'You define the dimensions and their weights. The same rubric is applied identically to every candidate for that role.', bullets: ['Dimensions and weights you control', 'Applied identically to everyone', 'Versioned, so you can show what changed'] },
      { h2: 'Every dimension cites its evidence', body: 'Each rubric dimension links to the exact answer, transcript span or signal it came from — so a reviewer can check the working, not just trust the number.' },
      { h2: 'What Mimic does not do', body: 'Mimic does not infer protected characteristics and does not use them in scoring. [PLACEHOLDER: confirm the exact model-input policy your team will publish]' },
    ],
    [{ q: 'Can a recruiter override a score?', a: 'Yes. Scores are recommendations; recruiters advance, reject or override, and every action is logged.' }, { q: 'Is the rubric the same for every candidate?', a: 'Yes — for a given role, one rubric is applied identically, which is what makes scores comparable and defensible.' }]),
  trust('bias-testing-audits', 'A', 'Responsible AI · Bias', 'Bias testing you can read, not take on faith.',
    'Bias Testing & Audits | Mimic Responsible AI',
    'Adverse-impact testing reported per rubric dimension, not summarised — so your DEI and legal teams can see the evidence, not a marketing claim.',
    '“Responsible AI” is on every vendor’s site. What your review actually needs is the adverse-impact numbers, per dimension, that you can hand to counsel.',
    [
      { h2: 'Adverse-impact testing per dimension', body: 'Selection rates are reported for each rubric dimension so disparate impact is visible where it happens, not hidden in an overall average.' },
      { h2: 'Independent review', body: '[PLACEHOLDER: confirm the third-party auditor, scope and cadence, and whether results are published].' },
      { h2: 'You can monitor it continuously', body: 'Analytics let you watch selection rates across groups over time, so a drift is caught early rather than in a lawsuit.' },
    ],
    [{ q: 'Do you publish audit results?', a: '[PLACEHOLDER: confirm what is published and where — e.g. an annual bias-audit summary.]' }]),
  trust('human-in-the-loop', 'A', 'Responsible AI · Oversight', 'A human makes every hiring decision.',
    'Human-in-the-Loop Review | Mimic',
    'Mimic recommends; people decide. Advancing, rejecting and overriding are recruiter actions — and every one is logged for a complete audit trail.',
    'Automated hiring decisions are exactly what regulators and candidates fear. Mimic is designed so the machine never makes the call.',
    [
      { h2: 'Mimic recommends, people decide', body: 'Every outcome that affects a candidate is a human action taken with the evidence in front of them.' },
      { h2: 'Every action is logged', body: 'Who advanced, rejected or overrode whom, when, and on what basis — a complete, exportable audit trail.', bullets: ['Advance / reject / override are human actions', 'Timestamped, attributed audit log', 'Exportable for review or dispute'] },
      { h2: 'Why this matters', body: 'Meaningful human oversight is a requirement under emerging AI-hiring law. Building it in is not a feature — it is the point.' },
    ],
    [{ q: 'Does Mimic ever reject a candidate on its own?', a: 'No. Rejection is always a logged human action.' }]),
  trust('model-data-transparency', 'B', 'Responsible AI · Transparency', 'Know what the model sees — and what it doesn’t.',
    'Model & Data Transparency | Mimic', 'What goes into a Mimic score, what is deliberately excluded, and where to find the model documentation your review team needs.',
    'Transparency is not a slogan; it is a list of inputs your reviewers can check.',
    [ { h2: 'What the model uses', body: 'Answers, transcripts and role-relevant signals, measured against your rubric.' }, { h2: 'What is excluded', body: 'Protected characteristics are not inferred or used. [PLACEHOLDER: confirm the exact input/exclusion list and model documentation to link here].' } ]),
  trust('candidate-rights', 'B', 'Responsible AI · Candidates', 'Candidates know they’re interviewing with AI.',
    'Candidate Rights & AI Disclosure | Mimic', 'Clear disclosure, consent, accommodation and data-access rights for every candidate Mimic interviews — the basics fair AI hiring requires.',
    'Candidate trust is part of your employer brand. Mimic makes disclosure and rights explicit, not buried.',
    [ { h2: 'Disclosure and consent', body: 'Candidates are told they are interviewing with AI and consent before starting. [PLACEHOLDER: confirm your consent-copy and jurisdictions].' }, { h2: 'Accommodation and access', body: 'Candidates can request accommodations and access or deletion of their data. [PLACEHOLDER: confirm the accommodation process].' } ]),
  trust('eu-ai-act', 'B', 'Compliance · EU AI Act', 'Built for the EU AI Act’s high-risk requirements.',
    'Mimic & the EU AI Act | Compliance', 'How Mimic supports EU AI Act obligations for hiring systems — transparency, human oversight, logging and documentation. Not legal advice.',
    'The EU AI Act classifies hiring AI as high-risk, which brings transparency, oversight, logging and documentation duties. Mimic is built to support them.',
    [ { h2: 'What the Act asks of hiring AI', body: 'Transparency to candidates, meaningful human oversight, record-keeping, and technical documentation, among others.' }, { h2: 'How Mimic supports it', body: 'AI disclosure to candidates, human-in-the-loop decisions, a complete audit log, and model documentation.', bullets: ['Candidate AI disclosure', 'Human oversight on every decision', 'Exportable audit logs', 'Model documentation [PLACEHOLDER: link]'] }, { h2: 'Not legal advice', body: 'This describes product capabilities. Your own counsel determines your obligations. [PLACEHOLDER: confirm counsel-reviewed statement].' } ]),
  trust('nyc-local-law-144', 'B', 'Compliance · NYC LL144', 'Ready for NYC Local Law 144 bias audits.',
    'Mimic & NYC Local Law 144 | Compliance', 'How Mimic supports NYC Local Law 144: the data behind an annual bias audit and the candidate notice the law requires. Not legal advice.',
    'NYC Local Law 144 requires an annual independent bias audit of automated employment decision tools and advance notice to candidates.',
    [ { h2: 'What LL144 requires', body: 'An annual third-party bias audit, publication of a summary, and notice to NYC candidates before use.' }, { h2: 'How Mimic supports it', body: 'Per-dimension selection-rate data for the audit, and candidate notice built into the flow.', bullets: ['Audit-ready selection-rate data', 'Candidate notice in the invite flow', '[PLACEHOLDER: confirm auditor + published summary]'] } ]),
  trust('illinois-aivia', 'B', 'Compliance · Illinois AIVIA', 'Supports the Illinois AI Video Interview Act.',
    'Mimic & Illinois AIVIA | Compliance', 'How Mimic supports the Illinois AI Video Interview Act: candidate notice, consent, and deletion on request. Not legal advice.',
    'For video interviews of Illinois candidates, AIVIA requires notice, consent, an explanation of how the AI works, and deletion on request.',
    [ { h2: 'What AIVIA requires', body: 'Notice before the interview, consent, a plain explanation of the AI, and deletion within 30 days of a request.' }, { h2: 'How Mimic supports it', body: 'Built-in disclosure and consent, a plain-language explanation, and data deletion controls. [PLACEHOLDER: confirm deletion SLA copy].' } ]),
  trust('gdpr-india-dpdp', 'B', 'Compliance · GDPR & DPDP', 'GDPR and India DPDP data controls, built in.',
    'GDPR & India DPDP | Mimic Compliance', 'Lawful basis, candidate data-subject rights, regional residency and configurable retention for GDPR and India’s DPDP Act. Not legal advice.',
    'Handling candidate data under GDPR and India’s DPDP Act means consent, data-subject rights, residency and retention — all first-class in Mimic.',
    [ { h2: 'Rights and consent', body: 'Consent capture, and access, rectification, erasure and portability on request.' }, { h2: 'Residency and retention', body: 'Regional data residency and configurable retention with purge on request. [PLACEHOLDER: confirm available regions and DPO contact].' } ]),
  trust('eeoc-adverse-impact', 'B', 'Compliance · EEOC', 'One rubric, applied identically — and measured.',
    'EEOC & Adverse Impact | Mimic Compliance', 'How a single, consistently-applied rubric plus per-dimension selection-rate reporting helps you monitor adverse impact under EEOC guidance. Not legal advice.',
    'US employers are expected to monitor selection procedures for adverse impact. A consistent, measured process is your best defence.',
    [ { h2: 'What adverse impact is', body: 'A selection rate for one group substantially below another (often referenced against the four-fifths rule).' }, { h2: 'How Mimic helps you monitor it', body: 'One rubric applied identically, with selection rates reported per dimension and an evidence trail for every decision.', bullets: ['Identical rubric for every candidate', 'Per-dimension selection-rate reporting', 'Evidence trail for defensibility'] } ]),
  trust('trust-center', 'A', 'Security · Trust Center', 'Everything security and legal need, in one place.',
    'Mimic Trust Center | Security & Compliance', 'Security controls, data-handling practices, sub-processors and reports — one place for your infosec and legal reviewers to get answers fast.',
    'A good Trust Center shortens your sales cycle: reviewers self-serve the answers instead of waiting on a questionnaire round-trip.',
    [ { h2: 'What’s here', body: 'An overview of security controls, data handling, residency and retention, sub-processors, and how to request reports.' }, { h2: 'Documents & reports', body: '[PLACEHOLDER: list the reports available on request — e.g. security whitepaper, pen-test summary — and how to request them].' }, { h2: 'How to get access', body: 'Reviewers can request gated documents under NDA. [PLACEHOLDER: request process / contact].' } ]),
  trust('certifications', 'B', 'Security · Certifications', 'Certifications & attestations.',
    'Certifications & Attestations | Mimic Security', 'The security and compliance attestations Mimic holds, and how to request the underlying reports for your review.',
    'We only list attestations we actually hold. Anything below marked as a placeholder is not yet claimed.',
    [ { h2: 'Attestations', body: '[PLACEHOLDER: list only certifications actually held — e.g. SOC 2 Type II, ISO 27001, ISO 42001. Do not display any that are not yet attested].' }, { h2: 'Requesting reports', body: 'Certification reports are available to qualified reviewers under NDA. [PLACEHOLDER: request process].' } ]),
  trust('data-residency-retention', 'B', 'Security · Data', 'Your data stays where you need it, only as long as you need it.',
    'Data Residency & Retention | Mimic Security', 'Choose where candidate data is stored, set how long it is kept, and purge on request — the residency and retention controls enterprise review expects.',
    'Where data lives and how long it is kept are the two questions every security review asks first.',
    [ { h2: 'Residency', body: 'Store candidate data in your required region. [PLACEHOLDER: confirm available regions].' }, { h2: 'Retention & purge', body: 'Configurable retention windows and deletion on request, including GDPR/DPDP erasure.' } ]),
  trust('sub-processors', 'B', 'Security · Sub-processors', 'Who we work with to run Mimic.',
    'Sub-processors | Mimic Security', 'The third-party sub-processors Mimic uses, what each does, and how we notify you of changes — full supply-chain transparency for your review.',
    'Your DPA review needs the sub-processor list. Here it is, with change notifications so nothing moves without your knowledge.',
    [ { h2: 'The list', body: '[PLACEHOLDER: current sub-processor list — name, purpose, region for each].' }, { h2: 'Change notifications', body: 'We notify customers before adding or changing a sub-processor. [PLACEHOLDER: notification method + notice period].' } ]),
  trust('status', 'B', 'Security · Status', 'Mimic system status.',
    'System Status | Mimic', 'Live service status, incident history and subscribe-for-updates — so your team always knows Mimic is up before a screening window opens.',
    'When you are screening at volume, uptime transparency is not optional.',
    [ { h2: 'Live status & history', body: 'Real-time component status and a public incident history. [PLACEHOLDER: status-page URL].' }, { h2: 'Subscribe', body: 'Subscribe to get notified of incidents and maintenance. [PLACEHOLDER: subscribe link].' } ]),
]

export const PAGES: MktPage[] = [...HUBS, ...SOLUTION_PAGES, ...SOLUTION_BRIEFS, ...TRUST_PAGES]
export const PAGE_BY_SLUG: Record<string, MktPage> = Object.fromEntries(PAGES.map((p) => [p.slug, p]))
export { DEMO }
