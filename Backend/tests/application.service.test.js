const { mockPrisma } = require('./helpers');
const { createApplicationService } = require('../src/modules/applications/application.service');

const candidate = { id: 1, role: 'CANDIDATE' };
const reviewer = { id: 9, role: 'REVIEWER' };
const NOW = new Date('2026-10-02T00:00:00Z');

function setup() {
  const prisma = mockPrisma();
  return { prisma, service: createApplicationService({ prisma, clock: () => NOW }) };
}

describe('create', () => {
  test('tạo hồ sơ DRAFT', async () => {
    const { prisma, service } = setup();
    prisma.program.findUnique.mockResolvedValue({ id: 5, isOpen: true });
    prisma.application.findFirst.mockResolvedValue(null);
    prisma.application.create.mockResolvedValue({ id: 10, status: 'DRAFT' });
    await service.create(candidate, { programId: 5 });
    expect(prisma.application.create).toHaveBeenCalledWith({ data: { candidateId: 1, programId: 5, status: 'DRAFT' } });
  });
  test('ngành không tồn tại -> 404', async () => {
    const { prisma, service } = setup();
    prisma.program.findUnique.mockResolvedValue(null);
    await expect(service.create(candidate, { programId: 5 })).rejects.toMatchObject({ status: 404 });
  });
  test('ngành đã đóng -> 409', async () => {
    const { prisma, service } = setup();
    prisma.program.findUnique.mockResolvedValue({ id: 5, isOpen: false });
    await expect(service.create(candidate, { programId: 5 })).rejects.toMatchObject({ code: 'PROGRAM_CLOSED' });
  });
  test('đã có hồ sơ cùng ngành -> 409', async () => {
    const { prisma, service } = setup();
    prisma.program.findUnique.mockResolvedValue({ id: 5, isOpen: true });
    prisma.application.findFirst.mockResolvedValue({ id: 3 });
    await expect(service.create(candidate, { programId: 5 })).rejects.toMatchObject({ code: 'DUPLICATE_APPLICATION' });
  });
});

describe('get / list', () => {
  test('thí sinh không xem được hồ sơ người khác -> 403', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue({ id: 1, candidateId: 2 });
    await expect(service.get(candidate, 1)).rejects.toMatchObject({ status: 403 });
  });
  test('cán bộ xem được mọi hồ sơ', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue({ id: 1, candidateId: 2 });
    await expect(service.get(reviewer, 1)).resolves.toMatchObject({ id: 1 });
  });
  test('thí sinh chỉ list hồ sơ của mình', async () => {
    const { prisma, service } = setup();
    prisma.application.findMany.mockResolvedValue([]);
    await service.list(candidate, { status: 'DRAFT' });
    expect(prisma.application.findMany.mock.calls[0][0].where).toEqual({ candidateId: 1, status: 'DRAFT' });
  });
});

describe('submit', () => {
  test('nộp hồ sơ DRAFT thành công', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue({ id: 1, candidateId: 1, status: 'DRAFT' });
    prisma.application.update.mockResolvedValue({ id: 1, status: 'SUBMITTED' });
    await service.submit(candidate, 1);
    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { status: 'SUBMITTED', submittedAt: NOW },
    });
  });
  test('nộp lại hồ sơ đã nộp -> 409', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue({ id: 1, candidateId: 1, status: 'SUBMITTED' });
    await expect(service.submit(candidate, 1)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
  test('người khác nộp hộ -> 403', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue({ id: 1, candidateId: 2, status: 'DRAFT' });
    await expect(service.submit(candidate, 1)).rejects.toMatchObject({ status: 403 });
  });
});

describe('review', () => {
  const submitted = { id: 1, candidateId: 1, status: 'SUBMITTED' };
  test('duyệt khi đã thanh toán', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue(submitted);
    prisma.payment.findFirst.mockResolvedValue({ id: 1, status: 'PAID' });
    prisma.application.update.mockResolvedValue({ id: 1, status: 'APPROVED' });
    await service.review(reviewer, 1, { decision: 'APPROVED', note: 'Đạt' });
    expect(prisma.application.update.mock.calls[0][0].data).toMatchObject({
      status: 'APPROVED', reviewedById: 9, reviewNote: 'Đạt',
    });
  });
  test('duyệt khi chưa thanh toán -> 409 PAYMENT_REQUIRED', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue(submitted);
    prisma.payment.findFirst.mockResolvedValue(null);
    await expect(service.review(reviewer, 1, { decision: 'APPROVED' })).rejects.toMatchObject({ code: 'PAYMENT_REQUIRED' });
  });
  test('từ chối không cần thanh toán', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue(submitted);
    prisma.application.update.mockResolvedValue({ id: 1, status: 'REJECTED' });
    await service.review(reviewer, 1, { decision: 'REJECTED' });
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });
  test('hồ sơ DRAFT không duyệt được', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue({ id: 1, status: 'DRAFT' });
    await expect(service.review(reviewer, 1, { decision: 'REJECTED' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
  test('hồ sơ đã APPROVED không đổi trạng thái được', async () => {
    const { prisma, service } = setup();
    prisma.application.findUnique.mockResolvedValue({ id: 1, status: 'APPROVED' });
    await expect(service.review(reviewer, 1, { decision: 'REJECTED' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});
