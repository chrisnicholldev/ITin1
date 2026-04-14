import 'express-async-errors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error.middleware.js';

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import ticketRoutes from './modules/tickets/ticket.routes.js';
import assetRoutes from './modules/assets/asset.routes.js';
import categoryRoutes from './modules/categories/category.routes.js';
import vaultRoutes from './modules/vault/vault.routes.js';
import rackRoutes from './modules/network/rack.routes.js';
import networkRoutes from './modules/network/network.routes.js';
import intuneRoutes from './modules/integrations/intune/intune.routes.js';
import merakiRoutes from './modules/integrations/meraki/meraki.routes.js';
import adRoutes from './modules/integrations/ad/ad.routes.js';
import contactRoutes from './modules/contacts/contact.routes.js';
import vendorRoutes from './modules/vendors/vendor.routes.js';
import adminRoutes from './modules/admin/backup.routes.js';
import locationRoutes from './modules/locations/location.routes.js';
import docsRoutes from './modules/docs/docs.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import secureShareRoutes from './modules/secure-share/secure-share.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import sslCertRoutes from './modules/ssl-certs/ssl-cert.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(): Express {
  const app = express();

  // Security
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );

  // Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Logging
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

  // Static file serving for uploads
  app.use('/uploads', express.static(path.resolve(__dirname, '..', env.UPLOAD_DIR)));

  // Routes
  const v1 = express.Router();
  v1.use('/auth', authRoutes);
  v1.use('/users', userRoutes);
  v1.use('/tickets', ticketRoutes);
  v1.use('/assets', assetRoutes);
  v1.use('/categories', categoryRoutes);
  v1.use('/vault', vaultRoutes);
  v1.use('/network/racks', rackRoutes);
  v1.use('/network/networks', networkRoutes);
  v1.use('/integrations/intune', intuneRoutes);
  v1.use('/integrations/meraki', merakiRoutes);
  v1.use('/integrations/ad', adRoutes);
  v1.use('/contacts', contactRoutes);
  v1.use('/vendors', vendorRoutes);
  v1.use('/admin', adminRoutes);
  v1.use('/locations', locationRoutes);
  v1.use('/docs', docsRoutes);
  v1.use('/dashboard', dashboardRoutes);
  v1.use('/secure-share', secureShareRoutes);
  v1.use('/search', searchRoutes);
  v1.use('/ssl-certs', sslCertRoutes);

  v1.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1', v1);

  // Error handler must be last
  app.use(errorHandler);

  return app;
}
