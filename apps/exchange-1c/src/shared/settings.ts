/** Настройки приложения — переменные приложения доступны как process.env. */
export type ExchangeSettings = {
  maxTasksPerRun: number;
  stuckMinutes: number;
  maxAttempts: number;
};

const toPositiveNumber = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const readSettings = (): ExchangeSettings => ({
  maxTasksPerRun: toPositiveNumber(process.env.MAX_TASKS_PER_RUN, 20),
  stuckMinutes: toPositiveNumber(process.env.STUCK_MINUTES, 10),
  maxAttempts: toPositiveNumber(process.env.MAX_ATTEMPTS, 3),
});
