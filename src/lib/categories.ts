export const EXPENSE_CATEGORIES = [
  { id: "food_shopping", label: "Food shopping", color: "#2F7D5B" },
  { id: "clothes", label: "Clothes & shoes", color: "#C2518B" },
  { id: "eating_out", label: "Eating out", color: "#E08A1E" },
  { id: "car", label: "Car", color: "#3B6FB6" },
  { id: "going_out", label: "Going out", color: "#7A4FBF" },
  { id: "entertainment", label: "Entertainment", color: "#1FA3A3" },
  { id: "school", label: "School", color: "#8B5A2B" },
  { id: "unexpected", label: "Unexpected", color: "#B3261E" },
  { id: "other", label: "Other", color: "#8A8F98" },
] as const;

export const INCOME_SOURCES = [
  { id: "salary", label: "Salary" },
  { id: "side", label: "Side income" },
] as const;

export const PAYMENT_METHODS = [
  { id: "card", label: "Card" },
  { id: "cash", label: "Cash" },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];
export type IncomeSourceId = (typeof INCOME_SOURCES)[number]["id"];
export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

export function isExpenseCategory(v: unknown): v is ExpenseCategoryId {
  return EXPENSE_CATEGORIES.some((c) => c.id === v);
}
export function isIncomeSource(v: unknown): v is IncomeSourceId {
  return INCOME_SOURCES.some((c) => c.id === v);
}
export function isPaymentMethod(v: unknown): v is PaymentMethodId {
  return PAYMENT_METHODS.some((c) => c.id === v);
}

export function categoryLabel(id: string): string {
  return (
    EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ??
    INCOME_SOURCES.find((c) => c.id === id)?.label ??
    "Other"
  );
}
export function categoryColor(id: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.color ?? "#8A8F98";
}
