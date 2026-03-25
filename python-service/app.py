from __future__ import annotations

from datetime import datetime
from math import atan2, cos, radians, sin, sqrt
from typing import List

import numpy as np
from flask import Flask, jsonify, request
from sklearn.ensemble import IsolationForest

app = Flask(__name__)


def haversine_distance_meters(start_lat: float, start_lng: float, end_lat: float, end_lng: float) -> float:
    earth_radius_meters = 6_371_000
    lat_delta = radians(end_lat - start_lat)
    lng_delta = radians(end_lng - start_lng)
    start_lat_rad = radians(start_lat)
    end_lat_rad = radians(end_lat)

    a = sin(lat_delta / 2) ** 2 + cos(start_lat_rad) * cos(end_lat_rad) * sin(lng_delta / 2) ** 2
    return 2 * earth_radius_meters * atan2(sqrt(a), sqrt(1 - a))


def parse_timestamp(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def build_feature_matrix(route: List[dict]) -> np.ndarray:
    features: list[list[float]] = []
    previous_point: dict | None = None

    for point in route:
        current_time = parse_timestamp(point["timestamp"])

        if previous_point is None:
            delta_seconds = 0.0
            distance_meters = 0.0
            speed_kmph = 0.0
        else:
            previous_time = parse_timestamp(previous_point["timestamp"])
            delta_seconds = max((current_time - previous_time).total_seconds(), 1.0)
            distance_meters = haversine_distance_meters(
                previous_point["lat"], previous_point["lng"], point["lat"], point["lng"]
            )
            speed_kmph = (distance_meters / delta_seconds) * 3.6

        features.append(
            [
                float(point["lat"]),
                float(point["lng"]),
                distance_meters,
                speed_kmph,
                delta_seconds,
            ]
        )
        previous_point = point

    return np.array(features, dtype=float)


def derive_reason(route: List[dict], anomaly_indices: List[int]) -> str:
    if not anomaly_indices:
        return "Route is within expected behavior."

    reasons: list[str] = []

    for index in anomaly_indices:
        if index == 0:
            reasons.append(f"Unusual starting point at index {index}.")
            continue

        previous_point = route[index - 1]
        current_point = route[index]
        previous_time = parse_timestamp(previous_point["timestamp"])
        current_time = parse_timestamp(current_point["timestamp"])
        elapsed_seconds = max((current_time - previous_time).total_seconds(), 1.0)
        distance_meters = haversine_distance_meters(
            previous_point["lat"],
            previous_point["lng"],
            current_point["lat"],
            current_point["lng"],
        )
        speed_kmph = (distance_meters / elapsed_seconds) * 3.6

        if elapsed_seconds >= 10 * 60 and distance_meters <= 40:
            reasons.append(f"Idling detected at index {index}.")
        elif distance_meters >= 1_000 or speed_kmph >= 45:
            reasons.append(f"Severe spatial deviation at index {index}.")
        else:
            reasons.append(f"Route outlier detected at index {index}.")

    unique_reasons = list(dict.fromkeys(reasons))
    return " ".join(unique_reasons)


@app.post("/detect")
def detect():
    payload = request.get_json(force=True, silent=False) or {}
    route = payload.get("route", [])

    if not isinstance(route, list) or len(route) < 3:
        return (
            jsonify(
                {
                    "status": "normal",
                    "anomalies_indices": [],
                    "reason": "Insufficient route history for anomaly detection.",
                }
            ),
            200,
        )

    features = build_feature_matrix(route)
    contamination = min(0.35, max(0.1, 2 / len(route)))
    model = IsolationForest(contamination=contamination, random_state=42)
    predictions = model.fit_predict(features)
    anomaly_indices = [index for index, prediction in enumerate(predictions.tolist()) if prediction == -1]

    return jsonify(
        {
            "status": "anomaly_found" if anomaly_indices else "normal",
            "anomalies_indices": anomaly_indices,
            "reason": derive_reason(route, anomaly_indices),
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
