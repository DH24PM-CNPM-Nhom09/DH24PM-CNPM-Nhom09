const { AppError } = require('../../utils/errors');

const STAFF_ROLES = ['STAFF', 'REVIEWER', 'ADMIN'];
const isStaff = (user) => STAFF_ROLES.includes(user.role);

// Máy trạng thái hồ sơ
const TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
};

function createApplicationService({ prisma, clock = () => new Date() }) {
  async function loadAccessible(user, id) {
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ');
    if (!isStaff(user) && app.candidateId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền với hồ sơ này');
    }
    return app;
  }

  function assertTransition(from, to) {
    if (!TRANSITIONS[from] || !TRANSITIONS[from].includes(to)) {
      throw new AppError(409, 'INVALID_STATE', `Không thể chuyển hồ sơ từ ${from} sang ${to}`);
    }
  }

  async function create(user, { programId }) {
    const program = await prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new AppError(404, 'PROGRAM_NOT_FOUND', 'Không tìm thấy ngành tuyển sinh');
    if (!program.isOpen) throw new AppError(409, 'PROGRAM_CLOSED', 'Ngành này đã đóng đăng ký');
    const existing = await prisma.application.findFirst({
      where: { candidateId: user.id, programId },
    });
    if (existing) throw new AppError(409, 'DUPLICATE_APPLICATION', 'Bạn đã có hồ sơ cho ngành này');
    return prisma.application.create({
      data: { candidateId: user.id, programId, status: 'DRAFT' },
    });
  }

  async function list(user, { status } = {}) {
    const where = isStaff(user) ? {} : { candidateId: user.id };
    if (status) where.status = status;
    return prisma.application.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async function get(user, id) {
    return loadAccessible(user, id);
  }

  async function submit(user, id) {
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ');
    if (app.candidateId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'Chỉ chủ hồ sơ mới được nộp');
    }
    assertTransition(app.status, 'SUBMITTED');
    return prisma.application.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: clock() },
    });
  }

  async function review(user, id, { decision, note }) {
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ');
    assertTransition(app.status, decision);

    if (decision === 'APPROVED') {
      const paid = await prisma.payment.findFirst({
        where: { applicationId: id, status: 'PAID' },
      });
      if (!paid) {
        throw new AppError(409, 'PAYMENT_REQUIRED', 'Hồ sơ chưa thanh toán lệ phí, không thể duyệt');
      }
    }
    return prisma.application.update({
      where: { id },
      data: { status: decision, reviewedById: user.id, reviewedAt: clock(), reviewNote: note || null },
    });
  }

  return { create, list, get, submit, review };
}

module.exports = { createApplicationService, TRANSITIONS };
