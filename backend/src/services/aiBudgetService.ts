import { env } from '../config/env.js';

export interface AiBudgetStatus {
  date: string;
  count: number;
  limit: number;
  remaining: number;
}

export class AiBudgetService {
  private currentDate: string;
  private callCount: number;
  private customLimit: number | null = null;

  constructor() {
    this.currentDate = this.getTodayDateString();
    this.callCount = 0;
  }

  private getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private syncDate(): void {
    const today = this.getTodayDateString();
    if (this.currentDate !== today) {
      this.currentDate = today;
      this.callCount = 0;
    }
  }

  public getLimit(): number {
    return this.customLimit !== null ? this.customLimit : env.maxAiCallsPerDay;
  }

  public setLimitForTesting(limit: number | null): void {
    this.customLimit = limit;
  }

  public resetForTesting(initialCount: number = 0): void {
    this.currentDate = this.getTodayDateString();
    this.callCount = initialCount;
  }

  /**
   * Attempts to consume 1 call from the global daily AI budget.
   * Returns true if allowed, or false if daily budget is exceeded.
   */
  public consumeBudget(): { allowed: boolean; status: AiBudgetStatus } {
    this.syncDate();
    const limit = this.getLimit();

    if (this.callCount >= limit) {
      return {
        allowed: false,
        status: {
          date: this.currentDate,
          count: this.callCount,
          limit,
          remaining: 0,
        },
      };
    }

    this.callCount += 1;
    return {
      allowed: true,
      status: {
        date: this.currentDate,
        count: this.callCount,
        limit,
        remaining: Math.max(0, limit - this.callCount),
      },
    };
  }

  public getStatus(): AiBudgetStatus {
    this.syncDate();
    const limit = this.getLimit();
    return {
      date: this.currentDate,
      count: this.callCount,
      limit,
      remaining: Math.max(0, limit - this.callCount),
    };
  }
}

export const aiBudgetService = new AiBudgetService();
