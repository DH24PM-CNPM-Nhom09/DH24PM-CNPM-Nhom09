const { mockPrisma, SECRET } = require('./helpers');
const { createAuthService } = require('../src/modules/auth/auth.service');

describe('AuthService.loginWithGoogle', () => {
  const build = (verifier, prisma = mockPrisma()) => ({
    prisma,
    service: createAuthService({ prisma, googleVerifier: verifier, jwtSecret: SECRET }),
  });

  test('đăng nhập thành công, tạo user CANDIDATE và trả JWT', async () => {
    const { service, prisma } = build(async () => ({ email: 'a@x.com', sub: 'g1', name: 'An', email_verified: true }));
    prisma.user.upsert.mockResolvedValue({ id: 1, email: 'a@x.com', fullName: 'An', role: 'CANDIDATE' });
    const res = await service.loginWithGoogle('token-gia-lap-123');
    expect(res.token).toEqual(expect.any(String));
    expect(res.user).toEqual({ id: 1, email: 'a@x.com', fullName: 'An', role: 'CANDIDATE' });
    expect(prisma.user.upsert.mock.calls[0][0].create.role).toBe('CANDIDATE');
  });

  test('token Google sai -> 401', async () => {
    const { service } = build(async () => { throw new Error('bad'); });
    await expect(service.loginWithGoogle('x')).rejects.toMatchObject({ status: 401, code: 'INVALID_GOOGLE_TOKEN' });
  });

  test('email chưa xác minh -> 401', async () => {
    const { service } = build(async () => ({ email: 'a@x.com', sub: 'g1', email_verified: false }));
    await expect(service.loginWithGoogle('x')).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
  });
});
