const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { AppError } = require('../../utils/errors');

function defaultGoogleVerifier(clientId) {
  const client = new OAuth2Client(clientId);
  return async (idToken) => {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    return ticket.getPayload();
  };
}

function createAuthService({ prisma, googleVerifier, jwtSecret, jwtExpiresIn = '1d' }) {
  const publicUser = (u) => ({ id: u.id, email: u.email, fullName: u.fullName, role: u.role });

  async function loginWithGoogle(idToken) {
    let payload;
    try {
      payload = await googleVerifier(idToken);
    } catch {
      throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Google ID token không hợp lệ');
    }
    if (!payload || !payload.email || payload.email_verified === false) {
      throw new AppError(401, 'EMAIL_NOT_VERIFIED', 'Email Google chưa được xác minh');
    }
    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: { googleId: payload.sub, fullName: payload.name },
      create: { email: payload.email, googleId: payload.sub, fullName: payload.name, role: 'CANDIDATE' },
    });
    const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });
    return { token, user: publicUser(user) };
  }

  async function getProfile(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');
    return publicUser(user);
  }

  return { loginWithGoogle, getProfile };
}

module.exports = { createAuthService, defaultGoogleVerifier };
