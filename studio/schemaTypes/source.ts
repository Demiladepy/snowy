import {defineField, defineType} from 'sanity'

export const source = defineType({
  name: 'source',
  title: 'Source',
  type: 'document',
  fields: [
    defineField({name: 'url', type: 'url', validation: (r) => r.required()}),
    defineField({name: 'title', type: 'string'}),
    defineField({
      name: 'kind',
      type: 'string',
      options: {list: ['docs', 'changelog', 'reference', 'cheatsheet', 'blog', 'learn']},
    }),
    defineField({
      name: 'evidence',
      type: 'text',
      rows: 2,
      description: 'Verbatim excerpt, 25 words or fewer',
      validation: (r) =>
        r.custom((v) => (!v || String(v).split(/\s+/).length <= 25 ? true : 'Keep evidence to 25 words or fewer')),
    }),
    defineField({name: 'retrievedAt', type: 'datetime'}),
  ],
  preview: {select: {title: 'evidence', subtitle: 'url'}},
})
