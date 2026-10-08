import helmet from 'helmet';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { ErrorEnvelopeFilter } from './common/filters/error-envelope.filter.js';
import { loadEnv } from './config/env.js';

/** Builds the configured Nest app; shared by main.ts and the e2e tests. */
export async function createApp() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, {
    logger: env.NODE_ENV === 'test' ? false : undefined,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorEnvelopeFilter());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });

  // Security headers, body limit & trust proxy
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  const httpAdapter = app.getHttpAdapter().getInstance();
  if (typeof httpAdapter?.disable === 'function') {
    httpAdapter.disable('x-powered-by');
  }
  if (typeof httpAdapter?.set === 'function') {
    httpAdapter.set('trust proxy', env.TRUST_PROXY);
  }

  if (env.NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Work Trail API').setVersion('1').addBearerAuth().build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }

  return app;
}
