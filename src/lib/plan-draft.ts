import { formatDate } from '$lib/@snaha/kalkul-maths'
import type { PlanEndType, PlanStartType } from '$lib/schemas'

const STORAGE_KEY = 'kalkul-plan-draft'

/** Raw form state of the add-plan "Details" step, persisted so the step can be re-hydrated. */
export interface PlanDraftDetails {
  name: string
  notes: string
  startType: PlanStartType
  startYear: string
  startMonth: string
  endType: PlanEndType
  endAge: number | undefined
  endYear: string
  endMonth: string
  currency: string
  inflation: number | undefined
}

/** Selections of the add-plan "Data" step, persisted so the step can be re-hydrated. */
export interface PlanDraftData {
  includeCash: boolean
  includeInvestments: boolean
  includeTangibleAssets: boolean
  includeLiabilities: boolean
  includeIncomes: boolean
  includeExpenses: boolean
  selectedInvestmentIds: string[]
  selectedTangibleAssetIds: string[]
  selectedLiabilityIds: string[]
  selectedIncomeIds: string[]
  selectedExpenseIds: string[]
}

/** The full add-plan draft kept in sessionStorage across the multi-step flow. */
export interface PlanDraft {
  details?: PlanDraftDetails
  data?: PlanDraftData
}

/** Values derived from the draft that are needed to create the portfolio. */
export interface PlanCreationFields {
  name: string
  notes: string | undefined
  currency: string
  start_date: string
  end_date: string
  inflation_rate: number
}

/** Load the current draft from sessionStorage, returning an empty draft if none/invalid. */
export function loadPlanDraft(): PlanDraft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PlanDraft) : {}
  } catch {
    return {}
  }
}

export function savePlanDraft(draft: PlanDraft): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
}

export function clearPlanDraft(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

/** Compute the plan start date from the raw "Details" form state. */
export function getPlanStartDate(details: PlanDraftDetails): string {
  if (details.startType === 'now') {
    const now = new Date()
    return formatDate(new Date(now.getFullYear(), now.getMonth(), 1))
  }
  return formatDate(new Date(Number(details.startYear), Number(details.startMonth), 1))
}

/** Compute the plan end date from the raw "Details" form state and the user's birth date. */
export function getPlanEndDate(details: PlanDraftDetails, birthDate: Date | undefined): string {
  if (details.endType === 'when_age_is' && details.endAge !== undefined) {
    if (birthDate) {
      return formatDate(new Date(birthDate.getFullYear() + details.endAge, birthDate.getMonth(), 1))
    }
    // Fallback: use start year + age
    const startYearNum =
      details.startType === 'now' ? new Date().getFullYear() : Number(details.startYear)
    return formatDate(new Date(startYearNum + details.endAge, 0, 1))
  }
  if (details.endYear && details.endMonth !== '') {
    return formatDate(new Date(Number(details.endYear), Number(details.endMonth), 1))
  }
  // Fallback (unreachable due to canContinue validation)
  return formatDate(new Date(new Date().getFullYear() + 30, 0, 1))
}

/** Build the portfolio-creation fields from the draft's "Details" state. */
export function buildPlanCreationFields(
  details: PlanDraftDetails,
  birthDate: Date | undefined,
): PlanCreationFields {
  return {
    name: details.name.trim(),
    notes: details.notes.trim() || undefined,
    currency: details.currency,
    start_date: getPlanStartDate(details),
    end_date: getPlanEndDate(details, birthDate),
    inflation_rate: (details.inflation ?? 2) / 100,
  }
}
