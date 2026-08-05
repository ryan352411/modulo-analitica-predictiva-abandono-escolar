FROM python:3.11-slim
WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
# Entrena el modelo en build (sintético); en producción montar un model.joblib real
RUN python -m app.train
EXPOSE 8000
# Render (y otros PaaS) inyectan el puerto en $PORT; localmente cae a 8000.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
