import { type TaxRule, taxRuleSchema } from '$lib/schemas'

/** Fields of `rule` that fail `taxRuleSchema`, e.g. a 150 % rate. */
export function invalidTaxRuleFields(rule: TaxRule): (keyof TaxRule)[] {
  const result = taxRuleSchema.safeParse(rule)
  if (result.success) return []
  return result.error.issues.map((issue) => String(issue.path[0]) as keyof TaxRule)
}
