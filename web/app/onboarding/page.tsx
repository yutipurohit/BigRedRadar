'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFollows } from '@/lib/follows'
import GoogleSignIn from '@/components/GoogleSignIn'
import { requestSurvey, SurveyRequestError } from '@/lib/survey-client'
import { useEffect, useRef, useState } from 'react'
import { TOPICS, SUBTOPICS, GOALS, TIME, SURVEY_VERSION, INTEREST_PRIORITIES, withSubtopicPriorities, type SurveyAnswers } from '@/lib/survey'
import styles from './survey.module.css'

const ALL_SUBTOPICS = TOPICS.flatMap(([topic, label]) => SUBTOPICS[topic].map(([id, detail]) => [`${topic}:${id}`, `${label} / ${detail}`] as const))

type Option = readonly [string, string]
function Choices({ title, hint, options, value, limit, onChange }: {
  title: string; hint: string; options: readonly Option[]; value: string[];
  limit: number; onChange: (value: string[]) => void
}) {
  return <fieldset className={styles.question}>
    <legend>{title}</legend>
    <p className={styles.hint}>{hint} All answers are optional.</p>
    <p className={styles.count} aria-live="polite">{value.length} of {limit} selected{value.length === limit ? ' · Uncheck one to choose another.' : ''}</p>
    <div className={styles.grid}>
      {options.map(([id, label]) => <label key={id} className={styles.choice}>
        <input type="checkbox" checked={value.includes(id)}
          disabled={value.length >= limit && !value.includes(id)}
          onChange={() => onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id])} />
        <span>{label}</span>
      </label>)}
    </div>
    <button type="button" className={styles.clear} onClick={() => onChange([])}>No preference / clear selections</button>
  </fieldset>
}

const emptyAnswers = (): SurveyAnswers => ({
  survey_version: SURVEY_VERSION, topic_ids: [], subtopic_ids: [], major_text: null,
  club_category_ids: [], goal_ids: [], weekly_commitment: null, subtopic_priorities: {},
})

export default function OnboardingPage() {
  const { me, ready } = useFollows()
  const guestDraft = useRef<SurveyAnswers | null>(null)
  useEffect(() => { if (me) guestDraft.current = null }, [me?.id])
  if (!ready) return <section className={styles.survey} role="status">Checking your account…</section>
  // Remount on identity changes: no prior account's answers can carry over.
  return <SurveyForm key={me?.id ?? 'guest'} signedIn={Boolean(me)}
    initialGuestDraft={guestDraft.current} onGuestDraft={draft => { guestDraft.current = draft }} />
}

function SurveyForm({ signedIn, initialGuestDraft, onGuestDraft }: {
  signedIn: boolean; initialGuestDraft: SurveyAnswers | null; onGuestDraft: (draft: SurveyAnswers) => void
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<SurveyAnswers>(() => withSubtopicPriorities(initialGuestDraft ?? emptyAnswers()))
  const [loading, setLoading] = useState(signedIn)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const [busy, setBusy] = useState<'save' | 'skip' | null>(null)
  const [saved, setSaved] = useState(false)
  const [retry, setRetry] = useState(0)
  const [guestChoice, setGuestChoice] = useState<SurveyAnswers | null>(null)
  const initialDraft = useRef(initialGuestDraft)
  const dirty = useRef(false)
  const operation = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!signedIn) return
    let alive = true
    setLoading(true)
    setLoadError('')
    requestSurvey('GET').then(profile => {
      if (!alive) return
      if (profile.answers) {
        if (initialDraft.current) setGuestChoice(initialDraft.current)
        setAnswers(withSubtopicPriorities(profile.answers))
      }
      setExpired(false)
    }).catch(err => {
      if (!alive) return
      setExpired(err instanceof SurveyRequestError && err.status === 401)
      setLoadError('We could not load your saved preferences. Retry before saving to avoid replacing them.')
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [signedIn, retry])
  useEffect(() => { if (!signedIn && dirty.current) onGuestDraft(answers) }, [signedIn, answers, onGuestDraft])

  const topics = answers.topic_ids, subtopics = answers.subtopic_ids
  const major = answers.major_text ?? ''
  const goals = answers.goal_ids, time = answers.weekly_commitment ?? ''
  function field<K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K] | ((previous: SurveyAnswers[K]) => SurveyAnswers[K])) {
    dirty.current = true
    setAnswers(previous => withSubtopicPriorities({ ...previous, [key]: typeof value === 'function' ? value(previous[key]) : value }))
    setError('')
    setSaved(false)
  }
  const setSubtopics = (value: string[] | ((previous: string[]) => string[])) => field('subtopic_ids', value)
  const setMajor = (value: string) => field('major_text', value)
  const setGoals = (value: string[]) => field('goal_ids', value)
  const setTime = (value: string) => field('weekly_commitment', value || null)
  async function persist(action: 'save' | 'skip') {
    if (operation.current || loading || guestChoice) return
    if (!signedIn) {
      if (action === 'skip') router.push('/explore')
      else setError('Sign in with Google below to save. Your answers will stay here while you sign in.')
      return
    }
    if (action === 'save' && loadError) return
    operation.current = true
    setBusy(action)
    setError('')
    try {
      const profile = await requestSurvey(action === 'save' ? 'PUT' : 'POST', action === 'save' ? answers : { action: 'skip' })
      if (!mounted.current) return
      setExpired(false)
      if (action === 'skip') router.push('/explore')
      else {
        if (profile.answers) setAnswers(withSubtopicPriorities(profile.answers))
        setSaved(true)
      }
    } catch (err) {
      if (!mounted.current) return
      const unauthorized = err instanceof SurveyRequestError && err.status === 401
      setExpired(unauthorized)
      setError(unauthorized ? 'Your session expired. Sign in again below, then retry. Your answers are still here.'
        : action === 'save' ? 'Your answers were not saved. Please try again; your choices are still here.'
        : 'We could not record your skip. Retry, or continue to Explore without changing your saved preferences.')
    } finally {
      operation.current = false
      if (mounted.current) setBusy(null)
    }
  }
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [step])
  const titles = ['What sparks your interest?', 'Make room for what matters', 'Review your survey']
  function updateTopics(next: string[]) {
    dirty.current = true
    setAnswers(previous => withSubtopicPriorities({ ...previous, topic_ids: next, subtopic_ids: previous.subtopic_ids.filter(id => next.includes(id.split(':')[0])) }))
    setSaved(false)
    setError('')
  }
  function labels(values: string[], options: readonly Option[]) {
    return values.map(id => options.find(([key]) => key === id)?.[1] ?? id).join(', ') || 'No preference'
  }

  return <section className={styles.survey} aria-label="Club interest survey">
    <div className={styles.eyebrow}>Club discovery · My preferences</div>
    <h1 ref={heading} tabIndex={-1} className={styles.heading}>{titles[step]}</h1>
    <p className={styles.intro}>A few quick choices to help shape your future club recommendations.</p>
    <p className={styles.notice}>Save your preferences to your account and change them here anytime. Every question is optional. Personalized recommendations are coming later.</p>
    <div className={styles.progress} aria-label={step < 2 ? `Step ${step + 1} of 2` : 'Review'}>
      {['Interests', 'Your pace'].map((label, index) => <span key={label} className={index <= step ? styles.active : ''} aria-current={step === index ? 'step' : undefined}>{index + 1}. {label}</span>)}
    </div>
    <p className={styles.hint}>{step < 2 ? `Step ${step + 1} of 2 · Designed to take under 2 minutes` : 'Check your choices before saving'}</p>

    {loading && <p role="status">Loading your preferences…</p>}
    {loadError && <div className={styles.notice} role="alert">{loadError} <button type="button" className={styles.clear} onClick={() => setRetry(value => value + 1)}>Retry loading</button></div>}
    {guestChoice && <div className={styles.notice}>
      <p>Your account already has saved preferences, shown below. You also entered answers before signing in. Which would you like to edit?</p>
      <button type="button" className={styles.clear} onClick={() => { setAnswers(withSubtopicPriorities({ ...guestChoice, club_category_ids: answers.club_category_ids })); setGuestChoice(null); initialDraft.current = null }}>Use answers I just entered</button>{' · '}
      <button type="button" className={styles.clear} onClick={() => { setGuestChoice(null); initialDraft.current = null }}>Keep saved preferences</button>
    </div>}
    {error && <p className={styles.notice} role="alert">{error}</p>}
    {(!signedIn || expired) && <div className={styles.notice}>
      <p>{expired ? 'Sign in again to continue saving.' : 'You can fill this out first. Sign in to save your preferences to your account.'} Unsaved answers reset when you leave or refresh.</p>
      <GoogleSignIn />
    </div>}
    {saved && <div className={styles.notice} role="status">Your preferences have been saved. <Link href="/explore">Continue to Explore →</Link></div>}
    <form onSubmit={event => { event.preventDefault(); if (step < 2) setStep(step + 1); else void persist('save') }}>
      <fieldset disabled={loading || Boolean(loadError) || Boolean(busy) || Boolean(guestChoice)} className={styles.formBody}>
      {step === 0 && <>
        <Choices title="1. What would you like to explore?" hint="Choose up to 5 interests, including things outside your major." options={TOPICS} value={topics} limit={5} onChange={updateTopics} />
        {topics.length > 0 && <section className={styles.details} aria-labelledby="detail-heading">
          <h2 id="detail-heading">Want to be more specific?</h2>
          <p id="detail-hint" className={styles.hint}>Optional · Select all detailed interests that appeal to you. There is no selection limit. Still exploring? Leave these blank and continue.</p>
          <p className={styles.hint}>Optional: set a priority for each selected interest. All start at 2 · Interested. Ties are welcome across categories.</p>
          <p className={styles.count} role="status">{subtopics.length} detailed interests selected overall</p>
          {TOPICS.filter(([topic]) => topics.includes(topic)).map(([topic, label]) => {
            const selectedCount = subtopics.filter(id => id.startsWith(`${topic}:`)).length
            return <details key={topic} open className={styles.topicDetails}>
            <summary>{label}<span>{selectedCount} selected</span></summary>
            <fieldset className={styles.detailGroup} aria-describedby="detail-hint">
              <legend className={styles.srOnly}>{label}: detailed interests</legend>
              <div className={styles.grid}>{SUBTOPICS[topic].map(([id, detail]) => {
                const key = `${topic}:${id}`
                const checked = subtopics.includes(key)
                return <div key={key} className={styles.interestCard} data-selected={checked}>
                  <label className={styles.choice}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setSubtopics(previous => previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key])} />
                    <span>{detail}</span>
                  </label>
                  {checked && <fieldset className={styles.priorityGroup}>
                    <legend className={styles.srOnly}>Priority for {detail}</legend>
                    <div className={styles.priorityOptions}>
                      {INTEREST_PRIORITIES.map(([priority, priorityLabel]) => <label key={priority} className={styles.priorityChoice}>
                        <input type="radio" className={styles.srOnly} name={`priority-${key}`} value={priority}
                          checked={(answers.subtopic_priorities?.[key] ?? 2) === priority}
                          onChange={() => field('subtopic_priorities', previous => ({ ...previous, [key]: priority }))} />
                        <span>{priority} · {priorityLabel}</span>
                      </label>)}
                    </div>
                  </fieldset>}
                </div>
              })}</div>
            </fieldset>
          </details>})}
          <button type="button" className={styles.clear} onClick={() => { setSubtopics([]); document.getElementById('major')?.focus() }}>Skip / clear detailed interests</button>
          <p className={styles.hint}>Removing a main interest also clears its detailed choices and priorities.</p>
        </section>}
        <div className={styles.question}>
          <label htmlFor="major" className={styles.label}>2. What is your major or intended area of study?</label>
          <p id="major-hint" className={styles.hint}>Optional. Undecided is welcome. You can leave this blank.</p>
          <input className="field" id="major" aria-describedby="major-hint" value={major} onChange={event => setMajor(event.target.value)} maxLength={100} placeholder="e.g., Biology, Computer Science, or Undecided" />
        </div>
      </>}
      {step === 1 && <>
        <Choices title="3. What are your main reasons for joining a club?" hint="Choose up to 2 that matter most to you right now." options={GOALS} value={goals} limit={2} onChange={setGoals} />
        <fieldset className={styles.question}>
          <legend>4. About how much time could you spend each week in total?</legend>
          <p className={styles.hint}>Optional. A rough preference, not a promise.</p>
          <div className={styles.grid}>{[...TIME, ['', 'Not sure / no preference']].map(([id, label]) => <label key={id} className={styles.choice}>
            <input type="radio" name="commitment" value={id} checked={time === id} onChange={() => setTime(id)} /><span>{label}</span>
          </label>)}</div>
        </fieldset>
      </>}
      {step === 2 && <>
        <dl className={styles.review}>
          <dt>Interests</dt><dd>{labels(topics, TOPICS)}</dd>
          <dt>Detailed interests (optional)</dt><dd>{subtopics.length ? INTEREST_PRIORITIES.map(([priority, label]) => {
            const values = subtopics.filter(id => (answers.subtopic_priorities?.[id] ?? 2) === priority)
            return values.length > 0 && <div key={priority} className={styles.priorityReview} role="group" aria-label={`${label} detailed interests`}>
              <strong>{priority} · {label}</strong>
              <ul>{values.map(id => <li key={id}>{labels([id], ALL_SUBTOPICS)}</li>)}</ul>
            </div>
          }) : 'Not specified — still exploring'}</dd>
          <dt>Major / area of study</dt><dd>{major.trim() || 'Not provided'}</dd>
          <dt>Goals</dt><dd>{labels(goals, GOALS)}</dd>
          <dt>Time per week</dt><dd>{TIME.find(([id]) => id === time)?.[1] || 'No preference'}</dd>
        </dl>
        <p className={styles.hint}>You can update these preferences anytime. Changes take effect only when you save.</p>
      </>}
      </fieldset>
      <div className={styles.actions}>
        {step > 0 && <button type="button" className="ghost" disabled={loading || Boolean(busy) || Boolean(guestChoice)} onClick={() => setStep(step === 2 ? 0 : step - 1)}>{step === 2 ? 'Edit answers' : 'Back'}</button>}
        {step < 2 ? <button className="primary" type="submit" disabled={loading || Boolean(loadError) || Boolean(busy) || Boolean(guestChoice)}>{step === 1 ? 'Review answers' : 'Continue'} <span aria-hidden="true">→</span></button> : <button className="primary" type="submit" disabled={loading || Boolean(loadError) || Boolean(busy) || Boolean(guestChoice)}>{busy === 'save' ? 'Saving…' : saved ? 'Saved' : 'Save preferences'}</button>}
        <button type="button" className={`${styles.clear} ${styles.skip}`} disabled={loading || Boolean(busy) || Boolean(guestChoice)} onClick={() => void persist('skip')}>{busy === 'skip' ? 'Skipping…' : 'Skip for now'}</button>
        {(loadError || error) && <Link className={styles.explore} href="/explore">Continue without saving →</Link>}
      </div>
    </form>
  </section>
}
