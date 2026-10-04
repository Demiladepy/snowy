import {defineField, defineType} from 'sanity'

const claimFields = [
  {name: 'source', type: 'reference', to: [{type: 'source'}]},
  {name: 'text', type: 'text', rows: 2},
]

export const docsFinding = defineType({
  name: 'docsFinding',
  title: 'Docs finding',
  type: 'document',
  fields: [
    defineField({name: 'title', type: 'string', validation: (r) => r.required()}),
    defineField({
      name: 'kind',
      type: 'string',
      options: {list: ['versionScoped', 'stale', 'wrong', 'coverageGap']},
      validation: (r) => r.required(),
    }),
    defineField({name: 'claimA', type: 'object', fields: claimFields}),
    defineField({name: 'claimB', type: 'object', fields: claimFields}),
    defineField({name: 'relatedRules', type: 'array', of: [{type: 'reference', to: [{type: 'rule'}]}]}),
    defineField({name: 'kbIssue', type: 'text', rows: 2, description: 'How it appeared in the KB Issues panel'}),
    defineField({name: 'resolution', type: 'text', rows: 3, description: 'The Instruction written'}),
    defineField({
      name: 'status',
      type: 'string',
      options: {list: ['triaged', 'reported', 'acknowledged', 'fixed']},
      initialValue: 'triaged',
    }),
    defineField({name: 'reportedVia', type: 'string'}),
  ],
})
