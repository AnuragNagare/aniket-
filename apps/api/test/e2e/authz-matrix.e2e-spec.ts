import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Role } from '@worktrail/types';
import { createApp } from '../../src/bootstrap.js';
import { IS_PUBLIC } from '../../src/modules/auth/decorators/public.decorator.js';
import { ROLES } from '../../src/modules/auth/decorators/roles.decorator.js';
import { resetDb } from '../helpers/db.js';
import { signupAs, employeeAs } from '../helpers/auth.js';

const METHOD_NAMES: Record<number, 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
};

type RouteMeta = {
  key: string;
  controllerName: string;
  methodName: string;
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  isPublic: boolean;
  roles: Role[] | null;
};

// Fixture map providing minimal valid payload generator for each route key `${METHOD} ${path}`
const FIXTURES: Record<string, (ctx: TestContext) => { body?: any; params?: Record<string, string> }> = {
  'POST /api/v1/auth/signup/admin': () => ({
    body: { companyName: 'Co', name: 'Admin', email: 'a@c.in', phone: '9876543210', password: 'Pass' },
  }),
  'POST /api/v1/auth/login': () => ({ body: { email: 'a@c.in', password: 'Pass' } }),
  'POST /api/v1/auth/refresh': () => ({ body: { refreshToken: 'x' } }),
  'POST /api/v1/auth/logout': () => ({ body: { refreshToken: 'x' } }),
  'POST /api/v1/auth/forgot-password': () => ({ body: { email: 'a@c.in' } }),
  'POST /api/v1/auth/reset-password': () => ({ body: { token: 'tok', password: 'Pass' } }),
  'GET /api/v1/auth/me': () => ({}),
  'GET /api/v1/health': () => ({}),
  'GET /api/v1/employees/invitations/:token': () => ({ params: { token: 'some-token' } }),
  'POST /api/v1/employees/invitations/:token/accept': () => ({
    params: { token: 'some-token' },
    body: { password: 'Pass' },
  }),
  'GET /api/v1/employees': () => ({}),
  'GET /api/v1/employees/:id': (ctx) => ({ params: { id: ctx.empB.id } }),
  'POST /api/v1/employees/invitations': () => ({
    body: { name: 'New Emp', email: 'new@example.com' },
  }),
  'POST /api/v1/employees/:employeeId/invitations': (ctx) => ({
    params: { employeeId: ctx.empB.id },
  }),
  'GET /api/v1/employees/:employeeId/summary': (ctx) => ({
    params: { employeeId: ctx.empB.id },
  }),
  'GET /api/v1/employees/:employeeId/sessions': (ctx) => ({
    params: { employeeId: ctx.empB.id },
  }),
  'GET /api/v1/employees/:employeeId/updates': (ctx) => ({
    params: { employeeId: ctx.empB.id },
  }),
  'GET /api/v1/employees/:employeeId/location-trail': (ctx) => ({
    params: { employeeId: ctx.empB.id },
  }),
  'POST /api/v1/employees/:employeeId/sessions/:sessionId/close': (ctx) => ({
    params: { employeeId: ctx.empB.id, sessionId: ctx.sessB.id },
    body: { endedAt: new Date().toISOString() },
  }),
  'GET /api/v1/work-sessions': () => ({}),
  'GET /api/v1/dashboard': () => ({}),
  'GET /api/v1/employees/:employeeId/summaries': (ctx) => ({
    params: { employeeId: ctx.empB.id },
  }),
  'POST /api/v1/employees/:employeeId/summaries': (ctx) => ({
    params: { employeeId: ctx.empB.id },
    body: { from: '2026-10-01', to: '2026-10-02' },
  }),
  'POST /api/v1/reports': (ctx) => ({
    body: { employeeId: ctx.empB.id, from: '2026-10-01', to: '2026-10-02' },
  }),
  'GET /api/v1/reports': () => ({}),
  'GET /api/v1/reports/:id': (ctx) => ({ params: { id: ctx.reportB.id } }),
  'GET /api/v1/reports/:id/download': (ctx) => ({ params: { id: ctx.reportB.id } }),
  'GET /api/v1/me': () => ({}),
  'GET /api/v1/me/history': () => ({}),
  'GET /api/v1/sessions/me/active': () => ({}),
  'POST /api/v1/sessions/start': () => ({
    body: {
      deviceTime: new Date().toISOString(),
    },
  }),
  'POST /api/v1/sessions/:sessionId/end': (ctx) => ({
    params: { sessionId: ctx.sessB.id },
    body: {
      deviceTime: new Date().toISOString(),
    },
  }),
  'POST /api/v1/locations/batch': () => ({
    body: { points: [] },
  }),
  'POST /api/v1/updates': (ctx) => ({
    body: {
      clientUpdateId: randomUUID(),
      sessionId: ctx.sessB.id,
      text: 'Visited client site',
      inputMethod: 'TYPED',
      submittedAt: new Date().toISOString(),
    },
  }),
  'GET /api/v1/privacy/notice': () => ({}),
  'POST /api/v1/me/consent': () => ({
    body: {
      version: '2026-10-v1',
    },
  }),
  'GET /api/v1/company': () => ({}),
  'PATCH /api/v1/company': () => ({
    body: {
      name: 'Updated Co',
    },
  }),
  'PATCH /api/v1/me/account': () => ({
    body: {
      name: 'Updated Admin',
    },
  }),
  'POST /api/v1/me/password': () => ({
    body: {
      current: 'StrongPass1',
      next: 'NewStrongPass2',
    },
  }),
  'GET /api/v1/audit-logs': () => ({}),
};


type TestContext = {
  adminA: { token: string; user: { id: string; companyId: string } };
  empA: { token: string; employee: { id: string }; user: { id: string } };
  adminB: { token: string; user: { id: string; companyId: string } };
  empB: { id: string };
  sessB: { id: string };
  reportB: { id: string };
};

describe('Authorisation matrix across every route', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let ctx: TestContext;
  let routes: RouteMeta[] = [];

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await resetDb(prisma);

    // Setup Company A (Admin + Employee)
    const adminA = await signupAs(app);
    const empA = await employeeAs(app, prisma, adminA.user.companyId);

    // Setup Company B (Admin + Employee + Session + Report)
    const adminB = await signupAs(app);
    const empBObj = await employeeAs(app, prisma, adminB.user.companyId);
    const sessB = await prisma.workSession.create({
      data: {
        companyId: adminB.user.companyId,
        employeeId: empBObj.employee.id,
        startedAtServer: new Date(),
      },
    });
    const reportB = await prisma.report.create({
      data: {
        companyId: adminB.user.companyId,
        employeeId: empBObj.employee.id,
        requestedByUserId: adminB.user.id,
        periodStart: new Date(),
        periodEnd: new Date(),
        status: 'READY',
      },
    });

    ctx = {
      adminA,
      empA,
      adminB,
      empB: empBObj.employee,
      sessB,
      reportB,
    };

    // Discover all registered routes
    const discovery = app.get(DiscoveryService);
    const metadataScanner = app.get(MetadataScanner);
    const reflector = app.get(Reflector);
    const controllers = discovery.getControllers();

    for (const wrapper of controllers) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;

      const controllerPath = reflector.get<string | string[]>(PATH_METADATA, metatype);
      if (controllerPath === undefined) continue;

      const basePaths = Array.isArray(controllerPath) ? controllerPath : [controllerPath];
      const controllerRoles = reflector.get<Role[]>(ROLES, metatype) ?? null;
      const controllerPublic = reflector.get<boolean>(IS_PUBLIC, metatype) ?? false;

      const prototype = Object.getPrototypeOf(instance);
      const methodNames = metadataScanner.getAllMethodNames(prototype);

      for (const methodName of methodNames) {
        const handler = prototype[methodName];
        const pathMeta = reflector.get<string | string[]>(PATH_METADATA, handler);
        const reqMethod = reflector.get<number>(METHOD_METADATA, handler);

        if (pathMeta === undefined || reqMethod === undefined) continue;

        const httpMethod = METHOD_NAMES[reqMethod];
        if (!httpMethod) continue;

        const subPaths = Array.isArray(pathMeta) ? pathMeta : [pathMeta];
        const isPublic = reflector.get<boolean>(IS_PUBLIC, handler) ?? controllerPublic;
        const roles = reflector.get<Role[]>(ROLES, handler) ?? controllerRoles;

        for (const basePath of basePaths) {
          for (const subPath of subPaths) {
            let cleanBase = basePath.startsWith('/') ? basePath : `/${basePath}`;
            if (cleanBase === '/') cleanBase = '';
            let cleanSub = subPath ? (subPath.startsWith('/') ? subPath : `/${subPath}`) : '';
            if (cleanSub === '/') cleanSub = '';
            const fullPath = `/api/v1${cleanBase}${cleanSub}` || '/api/v1';

            routes.push({
              key: `${httpMethod} ${fullPath}`,
              controllerName: metatype.name,
              methodName,
              httpMethod,
              path: fullPath,
              isPublic,
              roles,
            });
          }
        }
      }
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  function resolvePath(template: string, params: Record<string, string> = {}) {
    let out = template;
    for (const [k, v] of Object.entries(params)) {
      out = out.replace(`:${k}`, encodeURIComponent(v));
    }
    // Replace any remaining parameters with random UUIDs
    out = out.replace(/:[a-zA-Z0-9_]+/g, randomUUID());
    return out;
  }

  function makeRequest(method: string, path: string, token?: string, body?: any) {
    const s = request(app.getHttpServer());
    const m = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
    const req = s[m](path);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    if (path.includes('/locations/batch')) {
      req.set('idempotency-key', randomUUID());
    }
    if (body && ['post', 'put', 'patch'].includes(m)) {
      req.send(body);
    }
    return req;
  }

  it('every route has a fixture in the map', () => {
    for (const r of routes) {
      expect(
        FIXTURES[r.key],
        `Route ${r.key} is missing a fixture in FIXTURES map. Add a fixture for ${r.key}`,
      ).toBeDefined();
    }
  });

  it('enforces 401 on non-public routes called without a token', async () => {
    for (const r of routes) {
      if (r.isPublic) continue;

      const fixture = FIXTURES[r.key]?.(ctx) ?? {};
      const resolved = resolvePath(r.path, fixture.params);
      const res = await makeRequest(r.httpMethod, resolved, undefined, fixture.body);

      expect(res.status, `${r.key} should return 401 when unauthenticated`).toBe(401);
      expect(res.body?.error?.code).toBe('UNAUTHENTICATED');
    }
  });

  it('enforces 403 on routes called with the wrong role', async () => {
    for (const r of routes) {
      if (r.isPublic) continue;
      if (!r.roles || r.roles.length === 0) continue;

      const fixture = FIXTURES[r.key]?.(ctx) ?? {};
      const resolved = resolvePath(r.path, fixture.params);

      // If route is for ADMIN/OWNER only, call with employee token -> 403
      if (!r.roles.includes('EMPLOYEE')) {
        const res = await makeRequest(r.httpMethod, resolved, ctx.empA.token, fixture.body);
        expect(res.status, `${r.key} called by EMPLOYEE should return 403`).toBe(403);
        expect(res.body?.error?.code).toBe('FORBIDDEN');
      }

      // If route is for EMPLOYEE only, call with admin token -> 403
      if (!r.roles.includes('OWNER') && !r.roles.includes('ADMIN')) {
        const res = await makeRequest(r.httpMethod, resolved, ctx.adminA.token, fixture.body);
        expect(res.status, `${r.key} called by ADMIN should return 403`).toBe(403);
        expect(res.body?.error?.code).toBe('FORBIDDEN');
      }
    }
  });

  it('enforces 404 (and never 200 or 5xx) when Company A accesses Company B resources', async () => {
    for (const r of routes) {
      if (r.isPublic) continue;

      const fixture = FIXTURES[r.key]?.(ctx) ?? {};
      // Test only routes that operate on a specific resource (path params or body with employeeId/sessionId)
      const hasIdParam = r.path.includes(':');
      const hasForeignBodyId = fixture.body?.employeeId || fixture.body?.sessionId;

      if (!hasIdParam && !hasForeignBodyId) continue;

      const resolved = resolvePath(r.path, fixture.params);

      if (r.roles?.includes('OWNER') || r.roles?.includes('ADMIN')) {
        // Admin A trying to access resource of Company B
        const res = await makeRequest(r.httpMethod, resolved, ctx.adminA.token, fixture.body);
        expect(
          [400, 404].includes(res.status),
          `${r.key} accessed across companies should return 404 (or 400), got ${res.status}: ${JSON.stringify(res.body)}`,
        ).toBe(true);
        expect(res.body?.error).toBeDefined();
      } else if (r.roles?.includes('EMPLOYEE')) {
        // Employee A trying to access session of Company B
        const res = await makeRequest(r.httpMethod, resolved, ctx.empA.token, fixture.body);
        expect(
          [400, 404].includes(res.status),
          `${r.key} accessed across employees should return 404 (or 400), got ${res.status}: ${JSON.stringify(res.body)}`,
        ).toBe(true);
        expect(res.body?.error).toBeDefined();
      }
    }
  });
});
