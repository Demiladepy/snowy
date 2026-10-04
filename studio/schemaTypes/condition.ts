import {defineField, defineType} from 'sanity'

// Closed vocabulary: the rule engine (lib/engine.ts) is generic over these facts and operators.
export const condition = defineType({
  name: 'condition',
  title: 'Condition',
  type: 'object',
  fields: [
    defineField({
      name: 'fact',
      type: 'string',
      options: {list: ['apiVersion', 'perspective', 'token', 'useCdn', 'callSite', 'query', 'package', 'listenOption']},
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'op',
      type: 'string',
      options: {list: ['lt', 'gte', 'missing', 'dynamic', 'equals', 'in', 'unset', 'present', 'absent', 'matches', 'satisfies']},
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'value',
      type: 'string',
      description: 'in = comma-separated; matches = regex; satisfies = name@semver-range; apiVersion dates as YYYY-MM-DD',
    }),
  ],
  preview: {
    select: {fact: 'fact', op: 'op', value: 'value'},
    prepare: ({fact, op, value}) => ({title: `${fact} ${op}${value ? ` ${value}` : ''}`}),
  },
})
