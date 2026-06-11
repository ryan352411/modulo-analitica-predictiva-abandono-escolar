export function notFound(_req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

export function errorHandler(err, _req, res, _next) {
  console.error(err);

  const status = err.status || err.statusCode || 500;
  const isClientError = status >= 400 && status < 500;
  res.status(status).json({
    error: isClientError ? err.message : 'Error interno del servidor',
  });
}
