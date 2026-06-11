import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API — Módulo de Analítica Predictiva de Abandono Escolar',
      version: '1.0.0',
      description:
        'API REST del sistema de predicción de abandono escolar. ' +
        'El endpoint de predicción usa un stub que simula la salida de Random Forest/XGBoost.',
    },
    servers: [{ url: 'http://localhost:4000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
});
