import type {Metadata} from 'next'
import Workbench from './Workbench'
import {loadRules} from '@/lib/rules'

export const revalidate = 300
export const metadata: Metadata = {title: 'Analyze · Pinned'}

export default async function AnalyzePage() {
  const {rules, origin} = await loadRules()
  return <Workbench rules={rules} rulesOrigin={origin} />
}
