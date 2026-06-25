"""
Entrenamiento del modelo Random Forest de riesgo de abandono escolar.

En el MVP no hay datos históricos reales, así que se genera un dataset
sintético con relaciones plausibles entre variables académicas y abandono.
Cuando la institución aporte datos reales, basta con sustituir
`generate_synthetic_dataset()` por la carga del CSV/consulta real
manteniendo las mismas columnas.

Uso:
    python -m app.train
Genera: app/model.joblib y reporta AUC-ROC en consola.
"""
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score, f1_score, recall_score

RNG = np.random.default_rng(42)
SOCIO_MAP = {"bajo": 0, "medio_bajo": 1, "medio": 2, "medio_alto": 3, "alto": 4}
FEATURES = ["gpa", "attendance_rate", "failed_subjects", "credit_ratio", "socio_level"]
MODEL_PATH = Path(__file__).parent / "model.joblib"


def generate_synthetic_dataset(n: int = 6000) -> pd.DataFrame:
    gpa = np.clip(RNG.normal(8.0, 1.3, n), 0, 10)
    attendance = np.clip(RNG.normal(88, 12, n), 0, 100)
    failed = RNG.poisson(0.7, n)
    credit_ratio = np.clip(RNG.normal(0.85, 0.18, n), 0, 1)
    socio = RNG.integers(0, 5, n)

    # Probabilidad latente de abandono con relaciones plausibles
    logit = (
        -2.2
        + (8.0 - gpa) * 0.55
        + (90 - attendance) * 0.045
        + failed * 0.5
        + (1 - credit_ratio) * 1.8
        + (2 - socio) * 0.18
        + RNG.normal(0, 0.6, n)  # ruido
    )
    prob = 1 / (1 + np.exp(-logit))
    dropout = RNG.binomial(1, prob)

    return pd.DataFrame({
        "gpa": gpa,
        "attendance_rate": attendance,
        "failed_subjects": failed,
        "credit_ratio": credit_ratio,
        "socio_level": socio,
        "dropout": dropout,
    })


def main() -> dict:
    df = generate_synthetic_dataset()
    X, y = df[FEATURES], df["dropout"]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    model = RandomForestClassifier(
        n_estimators=300, max_depth=12, min_samples_leaf=5,
        class_weight="balanced", random_state=42, n_jobs=-1,
    )
    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, 1]
    preds = (proba >= 0.5).astype(int)
    metrics = {
        "auc_roc": round(float(roc_auc_score(y_test, proba)), 4),
        "accuracy": round(float(accuracy_score(y_test, preds)), 4),
        "f1": round(float(f1_score(y_test, preds)), 4),
        "recall": round(float(recall_score(y_test, preds)), 4),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
    }
    print(f"Métricas en prueba: {metrics}")

    trained_at = datetime.now(timezone.utc).isoformat()
    joblib.dump(
        {"model": model, "features": FEATURES, "metrics": metrics, "trained_at": trained_at},
        MODEL_PATH,
    )
    print(f"Modelo guardado en {MODEL_PATH}")
    return {"metrics": metrics, "trained_at": trained_at}


if __name__ == "__main__":
    main()
