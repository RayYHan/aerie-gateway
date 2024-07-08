import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getEnv } from './env.js';
import getLogger from './logger.js';
import initApiPlaygroundRoutes from './packages/api-playground/api-playground.js';
import initAuthRoutes from './packages/auth/routes.js';
import { DbMerlin } from './packages/db/db.js';
import initFileRoutes from './packages/files/files.js';
import initHealthRoutes from './packages/health/health.js';
import initSwaggerRoutes from './packages/swagger/swagger.js';
import cookieParser from 'cookie-parser';
import { AuthAdapter } from './packages/auth/types.js';
import { NoAuthAdapter } from './packages/auth/adapters/NoAuthAdapter.js';
import { CAMAuthAdapter } from './packages/auth/adapters/CAMAuthAdapter.js';
import { CSSOAuthAdapter } from './packages/auth/adapters/CSSOAuthAdapter.js';
import { validateGroupRoleMappings } from './packages/auth/functions.js';

async function main(): Promise<void> {
  const logger = getLogger('main');
  const { PORT, AUTH_TYPE } = getEnv();
  const app = express();
  const path_app = express();

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use('/gateway', path_app);

  await DbMerlin.init();

  let authHandler: AuthAdapter;
  switch (AUTH_TYPE) {
    case 'none':
      authHandler = NoAuthAdapter;
      break;
    case 'cam':
      validateGroupRoleMappings();
      authHandler = CAMAuthAdapter;
      break;
    case 'csso':
      validateGroupRoleMappings();
      authHandler = CSSOAuthAdapter;
      break;
    default:
      throw new Error(`invalid auth type env var: ${AUTH_TYPE}`);
  }

  initApiPlaygroundRoutes(app);
  initApiPlaygroundRoutes(path_app);
  initAuthRoutes(app, authHandler);
  initAuthRoutes(path_app, authHandler);
  initFileRoutes(app);
  initFileRoutes(path_app);
  initHealthRoutes(app);
  initHealthRoutes(path_app);
  initSwaggerRoutes(app);
  initSwaggerRoutes(path_app);

  app.listen(PORT, () => {
    logger.info(`🚀 AERIE-GATEWAY listening on ${PORT}`);
  });
}

main();
