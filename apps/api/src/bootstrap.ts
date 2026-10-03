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
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Work Trail API').setVersion('1').addBearerAuth().build(),
  );
  SwaggerModule.setup('api/docs', app, doc);
  return app;
}
