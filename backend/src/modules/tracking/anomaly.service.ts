import { env } from "../../config/env.js";

export interface RoutePointInput {
  lat: number;
  lng: number;
  timestamp: string;
}

interface FlaskAnomalyResponse {
  status: "normal" | "anomaly_found";
  anomalies_indices: number[];
  reason: string;
}

export interface WorkerRouteAnomalyResult {
  status: "normal" | "anomaly_found";
  anomaliesIndices: number[];
  reason: string;
}

export async function detectWorkerRouteAnomaly(input: {
  workerId: string;
  route: RoutePointInput[];
}): Promise<WorkerRouteAnomalyResult> {
  if (input.route.length < 3) {
    return {
      status: "normal",
      anomaliesIndices: [],
      reason: "Insufficient route history for anomaly detection."
    };
  }

  try {
    const response = await fetch(env.ANOMALY_DETECTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        worker_id: input.workerId,
        route: input.route
      })
    });

    if (!response.ok) {
      throw new Error(`Anomaly service returned ${response.status}`);
    }

    const body = (await response.json()) as FlaskAnomalyResponse;

    return {
      status: body.status,
      anomaliesIndices: body.anomalies_indices,
      reason: body.reason
    };
  } catch {
    return {
      status: "normal",
      anomaliesIndices: [],
      reason: "Anomaly service unavailable."
    };
  }
}
