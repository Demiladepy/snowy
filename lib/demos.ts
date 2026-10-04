// Scripted demo ops for /analyze. Each one is a real config; findings come from the live engine.

import {SAMPLES} from './samples'
import {EVAL_CASES} from '../scripts/eval-cases'

export interface DemoOp {
  id: string
  title: string
  pitch: string
  code: string
  packageJson?: string
  /** apiVersion the time machine jumps to after the run, to show what a bump changes */
  bumpTo?: string
}

const evalCase = (id: string) => EVAL_CASES.find((c) => c.id === id)!
const sample = (id: string) => SAMPLES.find((s) => s.id === id)!

export const DEMO_OPS: DemoOp[] = [
  {
    id: 'drafts-leak',
    title: 'The drafts leak',
    pitch: 'A 2024 Next.js tutorial client: token, old apiVersion, no perspective. Unpublished drafts reach production.',
    code: sample('tutorial-2024').code,
    packageJson: sample('tutorial-2024').packageJson,
    bumpTo: '2025-02-19',
  },
  {
    id: 'releases-blind',
    title: 'Studio plugin blind to Releases',
    pitch: 'A plugin on useClient pinned to 2023 never sees Content Release versions, and its listener misses them.',
    code: sample('studio-plugin').code,
    bumpTo: '2025-02-19',
  },
  {
    id: 'time-bomb',
    title: 'The time bomb',
    pitch: 'apiVersion computed from new Date(). Every API release silently changes this app without a deploy.',
    code: evalCase('tricky-date-apiversion').config,
  },
  {
    id: 'fallback',
    title: 'Hidden in a fallback',
    pitch: 'The next-sanity template pattern: an env var with a 2023 fallback. Pinned evaluates what runs when the env var is unset.',
    code: evalCase('tricky-env-fallback-token').config,
    bumpTo: '2025-02-19',
  },
  {
    id: 'empty-key',
    title: 'A GROQ bug you depend on',
    pitch: 'A projection with an empty-string key relies on a bug fixed in 2025-02-19. Bumping changes the response shape.',
    code: evalCase('tut-empty-key-projection').config,
    bumpTo: '2025-02-19',
  },
  {
    id: 'clean',
    title: 'Clean bill of health',
    pitch: 'A modern split: published client on the CDN, drafts preview client off it. Nothing should fire.',
    code: sample('modern').code,
  },
]

/** Version dates for the time machine slider, oldest first. */
export const TIME_MACHINE_STOPS = ['v1', '2021-03-25', '2022-11-15', '2023-05-03', '2024-06-01', '2025-02-19', '2025-10-01', '2026-10-01']
