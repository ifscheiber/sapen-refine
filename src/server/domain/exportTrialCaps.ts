import { getRuntimeConfig } from "@/server/runtime/config";

export type ExportTrialCapMetrics = {
  itemCount: number;
  estimatedBytes: number;
};

export type ExportTrialCapLimits = {
  maxItems: number;
  maxBytes: number;
};

export class ExportTrialCapError extends Error {
  public readonly status = 413;

  constructor(
    public readonly code: string,
    public readonly details: ExportTrialCapMetrics & ExportTrialCapLimits,
  ) {
    super(code);
  }
}

export function trainingExportTrialLimits(config = getRuntimeConfig().exportCaps): ExportTrialCapLimits {
  return {
    maxItems: config.trainingMaxItems,
    maxBytes: config.trainingMaxBytes,
  };
}

export function predictionAnalysisExportTrialLimits(
  config = getRuntimeConfig().exportCaps,
): ExportTrialCapLimits {
  return {
    maxItems: config.predictionAnalysisMaxItems,
    maxBytes: config.predictionAnalysisMaxBytes,
  };
}

export function assertExportWithinTrialCaps(params: {
  metrics: ExportTrialCapMetrics;
  limits: ExportTrialCapLimits;
  itemCode: string;
  byteCode: string;
}) {
  if (params.metrics.itemCount > params.limits.maxItems) {
    throw new ExportTrialCapError(params.itemCode, {
      ...params.metrics,
      ...params.limits,
    });
  }
  if (params.metrics.estimatedBytes > params.limits.maxBytes) {
    throw new ExportTrialCapError(params.byteCode, {
      ...params.metrics,
      ...params.limits,
    });
  }
}
