interface RetryConfig {
  maxAttempts?: number;
  delay?: number;
  backoff?: number;
}

export async function retry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
  } = config;

  let lastError: Error;
  let attempt = 1;
  let currentDelay = delay;

  while (attempt <= maxAttempts) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt === maxAttempts) break;

      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= backoff;
      attempt++;
    }
  }

  throw lastError!;
} 