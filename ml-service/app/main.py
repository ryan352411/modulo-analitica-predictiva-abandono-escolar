"""
Microservicio de predicción de abandono escolar — FastAPI.

Expone POST /predict con el mismo contrato que consume el backend Node
(services/mlService.js): recibe los datos del último registro académico
y devuelve risk_score, risk_level, model_version y contributing_features.
Si app/model.joblib no existe, ejecutar antes:  python -m app.train
"""
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODEL_PATH = Path(__file__).parent / "model.joblib"
SOCIO_MAP = {"bajo": 0, "medio_bajo": 1, "medio": 2, "medio_alto": 3, "alto": 4}
FEATURE_LABELS = {
    "gpa": "Promedio general",
    "attendance_rate": "Tasa de asistencia",
    "failed_subjects": "Materias reprobadas",
    "credit_ratio": "Avance de créditos",
    "socio_level": "Nivel socioeconómico",
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
    credits_earned: int = Field(0, ge=0)
    credits_total: int = Field(0, ge=0)
    socioeconomic_level: Optional[str] = "medio"

    class Config:
        extra = "ignore"  # tolera columnas adicionales del registro académico


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
    if score >= 0.7:
        return "alto"
    if score >= 0.4:
        return "medio"
    return "bajo"


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": MODEL_PATH.exists()}


@app.post("/predict", response_model=PredictionOutput)
def predict(payload: PredictionInput):
    bundle = get_bundle()
    model, features = bundle["model"], bundle["features"]

    credit_ratio = (
        payload.credits_earned / payload.credits_total
        if payload.credits_total > 0 else 1.0
    )
    row = pd.DataFrame([{
        "gpa": payload.gpa,
        "attendance_rate": payload.attendance_rate,
        "failed_subjects": payload.failed_subjects,
        "credit_ratio": credit_ratio,
        "socio_level": SOCIO_MAP.get(payload.socioeconomic_level or "medio", 2),
    }])[features]

    score = float(model.predict_proba(row)[0, 1])

    # Top 3 variables por importancia global del bosque
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
