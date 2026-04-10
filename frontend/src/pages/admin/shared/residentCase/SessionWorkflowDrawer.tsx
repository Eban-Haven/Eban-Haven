import { useMemo, useState } from 'react'
import { createProcessRecording } from '../../../../api/admin'
import { alertError, btnPrimary, input, label } from '../adminStyles'
import { CategoryBadge } from '../adminDataTable/AdminBadges'
import { CaseDrawer, ToggleField } from './caseUi'

const STEPS = ['Check-in', 'Context', 'Notes', 'Outcomes', 'Save'] as const
const SESSION_TYPES = ['Individual', 'Family', 'Group', 'Case conference', 'Crisis']
const EMOTIONAL_STATES = ['Calm', 'Anxious', 'Withdrawn', 'Sad', 'Angry', 'Overwhelmed', 'Hopeful', 'Neutral']

export function SessionWorkflowDrawer({
  residentId,
  assignedWorker,
  recentConcerns,
  activeGoals,
  recentActivity,
  onClose,
  onSaved,
}: {
  residentId: number
  assignedWorker: string
  recentConcerns: string[]
  activeGoals: string[]
  recentActivity: string[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10))
  const [socialWorker, setSocialWorker] = useState(assignedWorker)
  const [sessionType, setSessionType] = useState('Individual')
  const [duration, setDuration] = useState('45')
  const [emotionalStateObserved, setEmotionalStateObserved] = useState('')
  const [emotionalStateEnd, setEmotionalStateEnd] = useState('')
  const [sessionNarrative, setSessionNarrative] = useState('')
  const [interventionsApplied, setInterventionsApplied] = useState('')
  const [progressNoted, setProgressNoted] = useState(true)
  const [concernsFlagged, setConcernsFlagged] = useState(false)
  const [referralMade, setReferralMade] = useState(false)
  const [followUpActions, setFollowUpActions] = useState('')

  const summaryItems = useMemo(
    () => [
      ['Date', sessionDate],
      ['Worker', socialWorker || '—'],
      ['Type', sessionType],
      ['Start', emotionalStateObserved || '—'],
      ['End', emotionalStateEnd || '—'],
      ['Duration', duration ? `${duration} min` : '—'],
    ],
    [duration, emotionalStateEnd, emotionalStateObserved, sessionDate, sessionType, socialWorker],
  )

  async function submit() {
    setError(null)
    if (!socialWorker.trim()) {
      setError('Social worker is required.')
      setStep(0)
      return
    }
    if (!sessionNarrative.trim()) {
      setError('Session notes are required.')
      setStep(2)
      return
    }
    const minutes = duration.trim() ? Number.parseInt(duration, 10) : undefined
    if (duration.trim() && !Number.isFinite(minutes)) {
      setError('Duration must be a number.')
      setStep(0)
      return
    }

    setSaving(true)
    try {
      await createProcessRecording({
        residentId,
        sessionDate: `${sessionDate}T12:00:00`,
        socialWorker: socialWorker.trim(),
        sessionType,
        sessionDurationMinutes: minutes,
        emotionalStateObserved: emotionalStateObserved || undefined,
        emotionalStateEnd: emotionalStateEnd || undefined,
        sessionNarrative: sessionNarrative.trim(),
        interventionsApplied: interventionsApplied.trim() || undefined,
        followUpActions: followUpActions.trim() || undefined,
        progressNoted,
        concernsFlagged,
        referralMade,
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CaseDrawer
      title="Start session"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STEPS.map((label, index) => (
              <span
                key={label}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  step === index ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {index + 1}. {label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {step > 0 ? (
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
                onClick={() => setStep((value) => value - 1)}
                disabled={saving}
              >
                Back
              </button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button type="button" className={btnPrimary} onClick={() => setStep((value) => value + 1)} disabled={saving}>
                Next
              </button>
            ) : (
              <button type="button" className={btnPrimary} onClick={() => void submit()} disabled={saving}>
                {saving ? 'Saving…' : 'Save session'}
              </button>
            )}
          </div>
        </div>
      }
    >
      {error ? <div className={alertError}>{error}</div> : null}

      {step === 0 ? (
        <div className="space-y-3">
          <label className={label}>
            Session date
            <input type="date" className={input} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />
          </label>
          <label className={label}>
            Social worker
            <input className={input} value={socialWorker} onChange={(e) => setSocialWorker(e.target.value)} required />
          </label>
          <label className={label}>
            Session type
            <select className={input} value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
              {SESSION_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Duration (minutes)
            <input className={input} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <label className={label}>
            Emotional state observed
            <select className={input} value={emotionalStateObserved} onChange={(e) => setEmotionalStateObserved(e.target.value)}>
              <option value="">—</option>
              {EMOTIONAL_STATES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <ContextBlock title="Recent concerns" items={recentConcerns} emptyLabel="No recent concerns flagged." />
          <ContextBlock title="Active goals & plans" items={activeGoals} emptyLabel="No active goals on file." />
          <ContextBlock title="Recent activity" items={recentActivity} emptyLabel="No recent activity yet." />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <label className={label}>
            Session notes
            <textarea className={input} rows={6} value={sessionNarrative} onChange={(e) => setSessionNarrative(e.target.value)} />
          </label>
          <label className={label}>
            Interventions applied
            <textarea className={input} rows={4} value={interventionsApplied} onChange={(e) => setInterventionsApplied(e.target.value)} />
          </label>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <label className={label}>
            Emotional state at end
            <select className={input} value={emotionalStateEnd} onChange={(e) => setEmotionalStateEnd(e.target.value)}>
              <option value="">—</option>
              {EMOTIONAL_STATES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Follow-up actions
            <textarea className={input} rows={4} value={followUpActions} onChange={(e) => setFollowUpActions(e.target.value)} />
          </label>
          <ToggleField labelText="Progress noted" value={progressNoted} onChange={setProgressNoted} />
          <ToggleField labelText="Concerns flagged" value={concernsFlagged} onChange={setConcernsFlagged} />
          <ToggleField labelText="Referral made" value={referralMade} onChange={setReferralMade} />
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {summaryItems.map(([labelText, value]) => (
              <div key={labelText} className="rounded-xl border border-border bg-muted/20 px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{labelText}</p>
                <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Flags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <CategoryBadge>{progressNoted ? 'Progress noted' : 'No progress noted'}</CategoryBadge>
              <CategoryBadge>{concernsFlagged ? 'Concerns flagged' : 'No concerns flagged'}</CategoryBadge>
              <CategoryBadge>{referralMade ? 'Referral made' : 'No referral'}</CategoryBadge>
            </div>
            {followUpActions.trim() ? (
              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{followUpActions}</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No follow-up actions entered.</p>
            )}
          </div>
        </div>
      ) : null}
    </CaseDrawer>
  )
}

function ContextBlock({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: string[]
  emptyLabel: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-foreground">
          {items.map((item) => (
            <li key={item} className="rounded-lg bg-muted/30 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
