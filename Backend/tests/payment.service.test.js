const { mockPrisma } = require('./helpers');
const { createPaymentService } = require('../src/modules/payments/payment.service');

const candidate = { id: 1, role: 'CANDIDATE' };
const NOW = new Date('2026-10-02T00:00:00Z');

function setup() {
  const prisma = mockPrisma();
  return { prisma, service: createPaymentService({ prisma, fee: 500000, clock: () => NOW, genTxnRef: () => 'TS-TEST' }) };
}

describe('create', () => {
  test('tạo giao dịch PENDING với lệ phí cấu hình', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue({ id: 1, candidateId: 1, status: 'SUBMITTED' });
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({ id: 1 });
    await service.create(candidate, 1, { method: 'CARD' });
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: { applicationId: 1, amount: 500000, method: 'CARD', status: 'PENDING', txnRef: 'TS-TEST' },
    });
  });
  test('hồ sơ chưa nộp -> 409', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue({ id: 1, candidateId: 1, status: 'DRAFT' });
    await expect(service.create(candidate, 1, { method: 'CARD' })).rejects.toMatchObject({ code: 'APPLICATION_NOT_SUBMITTED' });
  });
  test('không thanh toán hộ hồ sơ người khác -> 403', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue({ id: 1, candidateId: 2, status: 'SUBMITTED' });
    await expect(service.create(candidate, 1, { method: 'CARD' })).rejects.toMatchObject({ status: 403 });
  });
  test('đã có giao dịch PENDING/PAID -> 409', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue({ id: 1, candidateId: 1, status: 'SUBMITTED' });
    prisma.payment.findFirst.mockResolvedValue({ id: 7 });
    await expect(service.create(candidate, 1, { method: 'CARD' })).rejects.toMatchObject({ code: 'PAYMENT_EXISTS' });
  });
});

describe('confirm', () => {
  test('PENDING -> PAID', async () => {
    const { prisma, service } = setup();
    prisma.payment.findUnique.mockResolvedValue({ id: 1, status: 'PENDING' });
    prisma.payment.update.mockResolvedValue({ id: 1, status: 'PAID' });
    await service.confirm(1);
    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 'PAID', paidAt: NOW } });
  });
  test('xác nhận lần hai -> 409', async () => {
    const { prisma, service } = setup();
    prisma.payment.findUnique.mockResolvedValue({ id: 1, status: 'PAID' });
    await expect(service.confirm(1)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
  test('không tồn tại -> 404', async () => {
    const { prisma, service } = setup();
    prisma.payment.findUnique.mockResolvedValue(null);
    await expect(service.confirm(1)).rejects.toMatchObject({ status: 404 });
  });
});
