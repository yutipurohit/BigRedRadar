import { sql } from './db'
import { createSurveyStore } from './survey-store'

export const { getSurveyProfile, saveSurveyProfile, skipSurveyProfile } = createSurveyStore(sql)
