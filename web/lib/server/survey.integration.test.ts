import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import postgres from 'postgres'
import { createSurveyStore } from './survey-store'
import { EMPTY_SURVEY_PROFILE, withSubtopicPriorities, type SurveyAnswers } from '../survey'

const url = process.env.SURVEY_TEST_DATABASE_URL
test('PostgreSQL migration and survey persistence', { skip: !url }, async () => {
  const schema = `survey_test_${randomBytes(8).toString('hex')}`
  const admin = postgres(url!, { max: 1, prepare: false })
  const db = postgres(url!, { max: 1, prepare: false, connection: { search_path: schema } })
  try {
    await admin`create schema ${admin(schema)}`
    // Only the referenced users key is needed to exercise this migration.
    await db`create table users (id bigint primary key)`
    const migration = await readFile(resolve(__dirname, '../../../db/migrations/009_survey_profiles.sql'), 'utf8')
    await db.unsafe(migration)
    await db.unsafe(migration) // Safe to apply twice.
    await db`insert into users (id) values (1), (2)`
    const store = createSurveyStore(db)
    const answers: SurveyAnswers = {
      survey_version: 2, topic_ids: ['technology'], subtopic_ids: ['technology:ai-data'],
      major_text: null, club_category_ids: ['academic'], goal_ids: [], weekly_commitment: null,
    }
    assert.deepEqual(await store.getSurveyProfile(1), EMPTY_SURVEY_PROFILE)
    const skipped = await store.skipSurveyProfile(1)
    assert.equal(skipped.status, 'skipped')
    assert.equal(skipped.answers, null)
    const saved = await store.saveSurveyProfile(1, answers)
    assert.equal(saved.status, 'completed')
    assert.deepEqual(saved.answers, withSubtopicPriorities(answers))
    assert.equal(saved.skipped_at, skipped.skipped_at)
    assert.ok(saved.completed_at)
    assert.deepEqual(await store.getSurveyProfile(1), saved)
    assert.deepEqual(await store.getSurveyProfile(2), EMPTY_SURVEY_PROFILE)
    const afterSkip = await store.skipSurveyProfile(1)
    assert.equal(afterSkip.status, 'completed')
    assert.deepEqual(afterSkip.answers, withSubtopicPriorities(answers))
    assert.equal(afterSkip.completed_at, saved.completed_at)
    const edited = await store.saveSurveyProfile(1, { ...answers, major_text: 'Biology' })
    assert.equal(edited.answers?.major_text, 'Biology')
    assert.equal(edited.completed_at, saved.completed_at)
    assert.equal((await db`select count(*)::int as n from user_survey_profiles where user_id = 1`)[0].n, 1)
    await assert.rejects(store.saveSurveyProfile(999, answers))
    await assert.rejects(db`insert into user_survey_profiles (user_id, status) values (2, 'completed')`)
    await assert.rejects(db`insert into user_survey_profiles (user_id, status, skipped_at, answers) values (2, 'skipped', now(), ${db.json(answers)})`)
    await db`delete from users where id = 1`
    assert.deepEqual(await store.getSurveyProfile(1), EMPTY_SURVEY_PROFILE)
  } finally {
    await db.end({ timeout: 2 })
    await admin`drop schema if exists ${admin(schema)} cascade`
    await admin.end({ timeout: 2 })
  }
})
