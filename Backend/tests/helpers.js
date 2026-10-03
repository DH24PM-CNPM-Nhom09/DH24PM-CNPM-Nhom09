const jwt = require('jsonwebtoken');

const SECRET = 'test-secret';

function mockPrisma() {
  return {
    user: { upsert: jest.fn(), findUnique: jest.fn() },
    program: { findUnique: jest.fn() },
    application: {
      create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
      findFirst: jest.fn(), update: jest.fn(),
    },
    payment: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
}

const tokenFor = (id, role) => jwt.sign({ sub: id, role }, SECRET, { expiresIn: '1h' });

module.exports = { SECRET, mockPrisma, tokenFor };
