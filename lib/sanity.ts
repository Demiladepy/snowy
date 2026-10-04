import {createClient} from '@sanity/client'

export const projectId = process.env.SANITY_PROJECT_ID || 'mttzxmvf'
export const dataset = process.env.SANITY_DATASET || 'production'
export const apiVersion = '2026-10-03'

/** Public, unauthenticated read client. The dataset is public-read and holds nothing sensitive. */
export const readClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: 'published',
})

export const publicDatasetUrl = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}?query=*%5B_type%3D%3D%22rule%22%5D`
