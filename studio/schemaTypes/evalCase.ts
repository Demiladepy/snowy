import {defineField, defineType} from 'sanity'

export const evalCase = defineType({
  name: 'evalCase',
  title: 'Eval case',
  type: 'document',
  fields: [
    defineField({name: 'name', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'config', type: 'text', rows: 12}),
    defineField({name: 'packageJson', type: 'text', rows: 4}),
    defineField({name: 'expectedRuleIds', type: 'array', of: [{type: 'string'}]}),
    defineField({name: 'notes', type: 'text', rows: 2}),
  ],
})
