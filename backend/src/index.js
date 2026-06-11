import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './docs/swagger.js';
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/students.routes.js';
import recordRoutes from './routes/records.routes.js';
import predictionRoutes from './routes/predictions.routes.js';
import alertRoutes from './routes/alerts.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import userRoutes from './routes/users.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Documentación
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rutas
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'abandono-escolar-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
  console.log(`Swagger UI en http://localhost:${PORT}/api/docs`);
});
