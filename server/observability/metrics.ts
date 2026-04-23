type RouteMetric = {
  count: number;
  totalLatencyMs: number;
  status4xx: number;
  status5xx: number;
  lastStatusCode: number;
};

const startedAt = Date.now();
const routeMetrics = new Map<string, RouteMetric>();

let totalRequests = 0;
let totalLatencyMs = 0;
let total4xx = 0;
let total5xx = 0;

function ensureRouteMetric(routeKey: string): RouteMetric {
  let metric = routeMetrics.get(routeKey);
  if (!metric) {
    metric = {
      count: 0,
      totalLatencyMs: 0,
      status4xx: 0,
      status5xx: 0,
      lastStatusCode: 200,
    };
    routeMetrics.set(routeKey, metric);
  }
  return metric;
}

export function recordHttpMetric(input: {
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
}) {
  totalRequests += 1;
  totalLatencyMs += input.latencyMs;

  if (input.statusCode >= 400 && input.statusCode < 500) {
    total4xx += 1;
  }
  if (input.statusCode >= 500) {
    total5xx += 1;
  }

  const routeKey = `${input.method.toUpperCase()} ${input.route}`;
  const metric = ensureRouteMetric(routeKey);
  metric.count += 1;
  metric.totalLatencyMs += input.latencyMs;
  metric.lastStatusCode = input.statusCode;

  if (input.statusCode >= 400 && input.statusCode < 500) {
    metric.status4xx += 1;
  }
  if (input.statusCode >= 500) {
    metric.status5xx += 1;
  }
}

export function getMetricsSnapshot() {
  const routes = Array.from(routeMetrics.entries())
    .map(([route, metric]) => ({
      route,
      count: metric.count,
      avgLatencyMs:
        metric.count > 0
          ? Number((metric.totalLatencyMs / metric.count).toFixed(2))
          : 0,
      status4xx: metric.status4xx,
      status5xx: metric.status5xx,
      status4xxRate:
        metric.count > 0
          ? Number(((metric.status4xx / metric.count) * 100).toFixed(2))
          : 0,
      status5xxRate:
        metric.count > 0
          ? Number(((metric.status5xx / metric.count) * 100).toFixed(2))
          : 0,
      lastStatusCode: metric.lastStatusCode,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    totals: {
      requestCount: totalRequests,
      avgLatencyMs:
        totalRequests > 0
          ? Number((totalLatencyMs / totalRequests).toFixed(2))
          : 0,
      status4xx: total4xx,
      status5xx: total5xx,
      status4xxRate:
        totalRequests > 0
          ? Number(((total4xx / totalRequests) * 100).toFixed(2))
          : 0,
      status5xxRate:
        totalRequests > 0
          ? Number(((total5xx / totalRequests) * 100).toFixed(2))
          : 0,
    },
    routes,
  };
}

