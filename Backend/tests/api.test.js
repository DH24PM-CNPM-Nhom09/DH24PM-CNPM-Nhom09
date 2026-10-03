const request = require('supertest');
const { mockPrisma, tokenFor, SECRET } = require('./helpers');
const { createApp } = require('../src/app');

function build() {
  const prisma = mockPrisma();
  const app = createApp({
    prisma,
    config: { jwtSecret: SECRET, applicationFee: 500000, corsOrigin: '*' },
    googleVerifier: async () => ({ email: 'a@x.com', sub: 'g', name: 'An', email_verified: true }),
  });
  return { app, prisma };
}

test('GET /health', async () => {
  const { app } = build();
  await request(app).get('/health').expect(200, { status: 'ok' });
});

test('không có token -> 401', async () => {
  const { app } = build();
  const res = await request(app).get('/api/v1/applications').expect(401);
  expect(res.body.error.code).toBe('UNAUTHENTICATED');
});

test('thí sinh gọi review -> 403', async () => {
  const { app } = build();
  await request(app)
    .post('/api/v1/applications/1/review')
    .set('Authorization', `Bearer ${tokenFor(1, 'CANDIDATE')}`)
    .send({ decision: 'REJECTED' })
    .expect(403);
});

test('body sai -> 400 VALIDATION_ERROR', async () => {
  const { app } = build();
  const res = await request(app)
    .post('/api/v1/applications')
    .set('Authorization', `Bearer ${tokenFor(1, 'CANDIDATE')}`)
    .send({ programId: 'abc' })
    .expect(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
});

test('tạo hồ sơ -> 201', async () => {
  const { app, prisma } = build();
  prisma.program.findUnique.mockResolvedValue({ id: 5, isOpen: true });
  prisma.application.findFirst.mockResolvedValue(null);
  prisma.application.create.mockResolvedValue({ id: 10, status: 'DRAFT' });
  const res = await request(app)
    .post('/api/v1/applications')
    .set('Authorization', `Bearer ${tokenFor(1, 'CANDIDATE')}`)
    .send({ programId: 5 })
    .expect(201);
  expect(res.body.id).toBe(10);
});

test('đăng nhập Google -> trả token', async () => {
  const { app, prisma } = build();
  prisma.user.upsert.mockResolvedValue({ id: 1, email: 'a@x.com', fullName: 'An', role: 'CANDIDATE' });
  const res = await request(app).post('/api/v1/auth/google').send({ idToken: 'abcdefghijk' }).expect(200);
  expect(res.body.token).toBeDefined();
});
