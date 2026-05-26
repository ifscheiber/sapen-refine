export type HealthStatus = {
  status: "ok";
  service: "sapen-annotate";
  timestamp: string;
};

export function getHealthStatus(now: Date = new Date()): HealthStatus {
  return {
    status: "ok",
    service: "sapen-annotate",
    timestamp: now.toISOString(),
  };
}
