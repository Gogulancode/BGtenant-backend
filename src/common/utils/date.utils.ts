export const startOfWeek = (date = new Date()): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - day); // Week starts on Sunday
  return result;
};

export const startOfPreviousWeek = (date = new Date()): Date => {
  const currentWeekStart = startOfWeek(date);
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  return currentWeekStart;
};

export const startOfNextWeek = (date = new Date()): Date => {
  const currentWeekStart = startOfWeek(date);
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  return currentWeekStart;
};

export const startOfMonth = (date = new Date()): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(1);
  return result;
};

export const formatMonthKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
};

/**
 * Get the week number in year (1-52)
 * Uses simple calculation: ceil((dayOfYear) / 7), clamped to 1-52
 * This MUST match Excel-style week distribution logic.
 */
export const getWeekNumber = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 1);
  const diffDays = Math.floor(
    (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  const week = Math.ceil((diffDays + 1) / 7);
  return Math.max(1, Math.min(week, 52));
};

/**
 * Get current week number (1-52) based on today's date
 */
export const getCurrentWeekNumber = (): number => {
  return getWeekNumber(new Date());
};

/**
 * Get the start and end dates for a given week number in a year
 */
export const getWeekDateRange = (
  year: number,
  weekNumber: number,
): { start: Date; end: Date } => {
  const jan1 = new Date(year, 0, 1);
  const daysToAdd = (weekNumber - 1) * 7;
  const start = new Date(jan1);
  start.setDate(jan1.getDate() + daysToAdd);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
};
