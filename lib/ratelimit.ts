const WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface Bucket {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  check(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let bucket = this.buckets.get(ip);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + WINDOW_MS };
      this.buckets.set(ip, bucket);
    }

    if (bucket.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    }

    bucket.count++;
    return {
      allowed: true,
      remaining: this.limit - bucket.count,
      resetAt: bucket.resetAt,
    };
  }

  // Cleanup stale entries to avoid memory leak on long-running instances
  cleanup(): void {
    const now = Date.now();
    for (const [ip, bucket] of this.buckets) {
      if (now > bucket.resetAt) this.buckets.delete(ip);
    }
  }
}

// 10 analysis requests per hour per IP
export const analyzeRateLimiter = new RateLimiter(10);
// 20 chat messages per hour per IP
export const chatRateLimiter = new RateLimiter(20);

export function getClientIp(req: Request): string {
  const forwarded = (req.headers as Headers).get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

export function rateLimitResponse(resetAt: number) {
  const minutesLeft = Math.ceil((resetAt - Date.now()) / 60_000);
  return {
    error: `Превышен лимит запросов. Попробуйте через ${minutesLeft} мин. (лимит: 10 анализов в час на один IP)`,
  };
}
