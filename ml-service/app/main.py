"""
Microservicio de predicción de abandono escolar — FastAPI.

Expone POST /predict con el mismo contrato que consume el backend Node
(services/mlService.js): recibe los datos del último registro académico
y devuelve risk_score, risk_level, model_version y contributing_features.
Si app/model.joblib no existe, ejecutar antes:  python -m app.train
"""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODEL_PATH = Path(__file__).parent / "model.joblib"
FEATURE_LABELS = {
    "gpa": "Promedio general",
    "attendance_rate": "Tasa de asistencia",
    "failed_subjects": "Materias reprobadas",
    "pending_deliverables": "Entregas pendientes",
}

app = FastAPI(
    title="ML Service — Abandono Escolar",
    version="1.0.0",
    description="Random Forest para estimar riesgo de abandono escolar.",
)

_bundle = None


def get_bundle():
    global _bundle
    if _bundle is None:
        if not MODEL_PATH.exists():
            raise HTTPException(
                status_code=503,
                detail="Modelo no entrenado. Ejecuta `python -m app.train` primero.",
            )
        _bundle = joblib.load(MODEL_PATH)
    return _bundle


class PredictionInput(BaseModel):
    gpa: float = Field(8.0, ge=0, le=10)
    attendance_rate: float = Field(90.0, ge=0, le=100)
    failed_subjects: int = Field(0, ge=0)
    pending_deliverables: int = Field(0, ge=0)

    class Config:
        extra = "ignore"


class FeatureImportance(BaseModel):
    feature: str
    label: str
    importance: float


class PredictionOutput(BaseModel):
    risk_score: float
    risk_level: str
    model_version: str
    contributing_features: list[FeatureImportance]


def risk_level(score: float) -> str:
    if score >= 0.85:
        return "critico"
    if score >= 0.7:
        return "alto"
    if score >= 0.4:
        return "medio"
    return "bajo"


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": MODEL_PATH.exists()}


@app.get("/model-info")
def model_info():
    """Metadatos del modelo activo: versión, features y métricas de entrenamiento."""
    if not MODEL_PATH.exists():
        return {"trained": False, "model_version": None}
    bundle = get_bundle()
    return {
        "trained": True,
        "model_version": "rf-v1 (scikit-learn RandomForest)",
        "features": bundle.get("features", []),
        "metrics": bundle.get("metrics", {}),
        "trained_at": bundle.get("trained_at"),
    }


@app.post("/retrain")
def retrain():
    """Reentrena el modelo de forma síncrona y recarga el bundle en memoria."""
    global _bundle
    from app.train import main as train_main

    metrics = train_main()
    _bundle = None
    return {"status": "ok", "retrained": True, **(metrics or {})}


@app.post("/predict", response_model=PredictionOutput)
def predict(payload: PredictionInput):
    bundle = get_bundle()
    model, features = bundle["model"], bundle["features"]

    row = pd.DataFrame(
        [
            {
                "gpa": payload.gpa,
                "attendance_rate": payload.attendance_rate,
                "failed_subjects": payload.failed_subjects,
                "pending_deliverables": payload.pending_deliverables,
            }
        ]
    )[features]

    score = float(model.predict_proba(row)[0, 1])

    importances = model.feature_importances_
    top = np.argsort(importances)[::-1][:3]
    contributing = [
        FeatureImportance(
            feature=features[i],
            label=FEATURE_LABELS[features[i]],
            importance=round(float(importances[i]), 4),
        )
        for i in top
    ]

    return PredictionOutput(
        risk_score=round(score, 4),
        risk_level=risk_level(score),
        model_version="rf-v1 (scikit-learn RandomForest)",
        contributing_features=contributing,
    )
