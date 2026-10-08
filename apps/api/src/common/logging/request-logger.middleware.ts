import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { CLS_COMPANY_ID, CLS_USER_ID } from '../context/request-context.js';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const requestId = this.cls.getId();

    if (requestId) {
      res.setHeader('x-request-id', requestId);
    }

    res.on('finish', () => {
      const ms = Date.now() - start;
      const route = req.route?.path ?? (req as any).baseUrl ?? 'unmatched';
      const userId = this.cls.get<string>(CLS_USER_ID) ?? null;
      const companyId = this.cls.get<string>(CLS_COMPANY_ID) ?? null;

      const logEntry = {
        requestId: requestId ?? null,
        method: req.method,
        route: typeof route === 'string' ? route : 'unmatched',
        status: res.statusCode,
        ms,
        userId,
        companyId,
      };

      this.logger.log(JSON.stringify(logEntry));
    });

    next();
  }
}
