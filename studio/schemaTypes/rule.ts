import {defineField, defineType} from 'sanity'

export const rule = defineType({
  name: 'rule',
  title: 'Rule',
  type: 'document',
  fields: [
    defineField({name: 'ruleId', type: 'slug', validation: (r) => r.required()}),
    defineField({name: 'title', type: 'string', validation: (r) => r.required()}),
    defineField({
      name: 'area',
      type: 'string',
      options: {list: ['perspective', 'apiVersion', 'releases', 'cdn', 'listen', 'groq', 'studio', 'client']},
    }),
    defineField({
      name: 'severity',
      type: 'string',
      options: {list: ['critical', 'warning', 'info']},
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'boundary',
      type: 'object',
      fields: [
        {name: 'apiVersion', type: 'string', description: 'e.g. 2025-02-19'},
        {name: 'package', type: 'string', description: 'e.g. @sanity/client (optional)'},
        {name: 'packageRange', type: 'string', description: 'semver range (optional)'},
      ],
    }),
    defineField({
      name: 'conditions',
      type: 'array',
      of: [{type: 'condition'}],
      description: 'ALL conditions must hold for the rule to fire',
      validation: (r) => r.min(1),
    }),
    defineField({name: 'nowBehavior', type: 'text', rows: 3}),
    defineField({name: 'afterBumpBehavior', type: 'text', rows: 3}),
    defineField({name: 'fix', type: 'text', rows: 3}),
    defineField({
      name: 'sources',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'source'}]}],
      validation: (r) => r.min(1),
    }),
    defineField({
      name: 'verified',
      type: 'boolean',
      initialValue: false,
      description: 'Only set after reading every source',
    }),
  ],
  preview: {select: {title: 'title', subtitle: 'ruleId.current'}},
})
