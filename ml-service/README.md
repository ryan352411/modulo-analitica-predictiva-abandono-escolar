# Microservicio ML — Riesgo de Abandono Escolar

FastAPI + scikit-learn (Random Forest). Reemplaza al stub del backend cuando
`ML_SERVICE_URL` está configurada en el `.env` del backend.

## Uso local

```bash
cd ml-service
python -m venv .venv && source .venv/bin/activate   # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.train          # entrena con datos sintéticos y reporta AUC-ROC
uvicorn app.main:app --reload --port 8000
```

Documentación interactiva: http://localhost:8000/docs

## Contrato

`POST /predict`
```json
{ "gpa": 6.5, "attendance_rate": 72, "failed_subjects": 3,
  "credits_earned": 20, "credits_total": 30, "socioeconomic_level": "medio_bajo" }
```
Respuesta:
```json
{ "risk_score": 0.81, "risk_level": "alto",
  "model_version": "rf-v1 (scikit-learn RandomForest)",
  "contributing_features": [ { "feature": "gpa", "label": "Promedio general", "importance": 0.41 } ] }
```

## Datos reales

`app/train.py` usa un dataset sintético mientras no existan históricos.
Para entrenar con datos reales, sustituir `generate_synthetic_dataset()`
por la carga del CSV o consulta a Supabase, conservando las columnas:
`gpa, attendance_rate, failed_subjects, credit_ratio, socio_level, dropout`.
