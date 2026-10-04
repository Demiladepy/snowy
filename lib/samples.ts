// The three one-click sample inputs on the home page.

export interface Sample {
  id: string
  label: string
  code: string
  packageJson?: string
  queries?: string
  expectedRuleIds: string[]
}

export const SAMPLES: Sample[] = [
  {
    id: 'tutorial-2024',
    label: '2024 Next.js tutorial client',
    code: `// sanity/lib/client.ts
import {createClient} from 'next-sanity'

export const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_API_READ_TOKEN,
})

export const previewClient = client.withConfig({
  perspective: 'previewDrafts',
})

export async function getPosts() {
  return client.fetch(groq\`*[_type == "post"] | order(publishedAt desc){title, slug}\`)
}
`,
    packageJson: JSON.stringify({dependencies: {'next-sanity': '^9.4.0', next: '14.2.3'}}, null, 2),
    expectedRuleIds: ['drafts-leak-raw-default', 'previewDrafts-deprecated'],
  },
  {
    id: 'studio-plugin',
    label: 'Studio plugin using useClient',
    code: `// plugins/release-badge/ReleaseBadge.tsx
import {useEffect, useState} from 'react'
import {useClient} from 'sanity'

export function ReleaseBadge({documentId}: {documentId: string}) {
  const client = useClient({apiVersion: '2023-08-01'})
  const [count, setCount] = useState(0)

  useEffect(() => {
    client
      .fetch('count(*[sanity::versionOf($id)])', {id: documentId})
      .then(setCount)

    const sub = client
      .listen('*[_id == $id]', {id: documentId})
      .subscribe(() => setCount((c) => c + 1))
    return () => sub.unsubscribe()
  }, [client, documentId])

  return <span>{count} versions</span>
}
`,
    expectedRuleIds: ['useClient-releases', 'versions-invisible-pre-2025', 'listen-include-all-versions'],
  },
  {
    id: 'modern',
    label: 'Modern config (should pass)',
    code: `// sanity/lib/client.ts
import {createClient} from 'next-sanity'

export const client = createClient({
  projectId: 'abc123',
  dataset: 'production',
  apiVersion: '2026-09-01',
  useCdn: true,
  perspective: 'published',
})

export const previewClient = client.withConfig({
  perspective: 'drafts',
  useCdn: false,
  token: process.env.SANITY_VIEWER_TOKEN,
})
`,
    expectedRuleIds: [],
  },
]
