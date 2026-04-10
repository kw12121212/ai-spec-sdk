/**
 * In-memory metrics collector producing Prometheus text exposition format.
 * No external dependencies.
 */

export class MetricsCollector {
  private requestCounters = new Map<string, number>();
  private durationData = new Map<string, { count: number; sum: number }>();
  private tokensConsumed = 0;
  private rateLimitRejections = 0;

  /** Increment the request counter for a given method and HTTP status. */
  incRequests(method: string, status: number): void {
    const key = `bridge_requests_total{method="${method}",status="${status}"}`;
    this.requestCounters.set(key, (this.requestCounters.get(key) ?? 0) + 1);
  }

  /** Observe an RPC duration in seconds for a given method. */
  observeDuration(method: string, durationSeconds: number): void {
    const existing = this.durationData.get(method);
    if (existing) {
      existing.count += 1;
      existing.sum += durationSeconds;
    } else {
      this.durationData.set(method, { count: 1, sum: durationSeconds });
    }
  }

  /** Add to the total tokens consumed counter. */
  incTokens(count: number): void {
    this.tokensConsumed += count;
  }

  /** Increment rate limit rejection counter. */
  incRateLimitRejections(): void {
    this.rateLimitRejections += 1;
  }

  /** Return the current number of active sessions (set externally). */
  get activeSessions(): number {
    return this._activeSessions;
  }

  set activeSessions(count: number) {
    this._activeSessions = count;
  }

  private _activeSessions = 0;

  /** Render all metrics in Prometheus text exposition format. */
  render(): string {
    const lines: string[] = [];

    // bridge_requests_total
    lines.push("# HELP bridge_requests_total Total JSON-RPC requests processed");
    lines.push("# TYPE bridge_requests_total counter");
    for (const [key, value] of sortedEntries(this.requestCounters)) {
      lines.push(`${key} ${value}`);
    }
    // Ensure at least one value line so scrapers see the metric
    if (this.requestCounters.size === 0) {
      lines.push('bridge_requests_total{method="",status="0"} 0');
    }

    // bridge_rpc_duration_seconds
    lines.push("# HELP bridge_rpc_duration_seconds RPC request duration in seconds");
    lines.push("# TYPE bridge_rpc_duration_seconds summary");
    for (const [method, data] of sortedEntries(this.durationData)) {
      lines.push(`bridge_rpc_duration_seconds_count{method="${method}"} ${data.count}`);
      lines.push(`bridge_rpc_duration_seconds_sum{method="${method}"} ${data.sum}`);
    }
    if (this.durationData.size === 0) {
      lines.push('bridge_rpc_duration_seconds_count{method=""} 0');
      lines.push('bridge_rpc_duration_seconds_sum{method=""} 0');
    }

    // bridge_tokens_consumed_total
    lines.push("# HELP bridge_tokens_consumed_total Total tokens consumed across all sessions");
    lines.push("# TYPE bridge_tokens_consumed_total counter");
    lines.push(`bridge_tokens_consumed_total ${this.tokensConsumed}`);

    // bridge_sessions_active
    lines.push("# HELP bridge_sessions_active Number of currently active sessions");
    lines.push("# TYPE bridge_sessions_active gauge");
    lines.push(`bridge_sessions_active ${this._activeSessions}`);

    // bridge_rate_limit_rejections_total
    lines.push("# HELP bridge_rate_limit_rejections_total Total requests rejected by rate limiter");
    lines.push("# TYPE bridge_rate_limit_rejections_total counter");
    lines.push(`bridge_rate_limit_rejections_total ${this.rateLimitRejections}`);

    return lines.join("\n") + "\n";
  }
}

function sortedEntries<T>(map: Map<string, T>): [string, T][] {
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
