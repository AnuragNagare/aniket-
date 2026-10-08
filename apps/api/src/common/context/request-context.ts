import { randomUUID } from 'node:crypto';
import { ClsModule, ClsServiceManager } from 'nestjs-cls';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validUuid(val: unknown): string | null {
  if (typeof val === 'string' && UUID_REGEX.test(val)) {
    return val;
  }
  return null;
}

export const CLS_REQUEST_ID = 'requestId';
export const CLS_IP = 'ip';
export const CLS_USER_AGENT = 'userAgent';
export const CLS_USER_ID = 'userId';
export const CLS_COMPANY_ID = 'companyId';

export function createClsModule() {
  return ClsModule.forRoot({
    global: true,
    middleware: {
      mount: true,
      generateId: true,
      idGenerator: (req) => {
        const incoming = req.headers['x-request-id'];
        const valid = validUuid(incoming);
        return valid ?? randomUUID();
      },
      setup: (cls, req) => {
        const ip = req.ip || req.socket?.remoteAddress;
        cls.set(CLS_IP, ip ? String(ip) : null);
        cls.set(CLS_USER_AGENT, String(req.headers['user-agent'] ?? '').slice(0, 255));
      },
    },
  });
}

export function getRequestContext() {
  try {
    const cls = ClsServiceManager.getClsService();
    if (!cls || !cls.isActive()) return null;
    return {
      requestId: cls.getId(),
      ip: cls.get<string>(CLS_IP) ?? null,
      userAgent: cls.get<string>(CLS_USER_AGENT) ?? null,
      userId: cls.get<string>(CLS_USER_ID) ?? null,
      companyId: cls.get<string>(CLS_COMPANY_ID) ?? null,
    };
  } catch {
    return null;
  }
}
