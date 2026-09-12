import 'dotenv/config'
import postgres from 'postgres'

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error('DATABASE_URL is missing')
}

export const sql = postgres(url)