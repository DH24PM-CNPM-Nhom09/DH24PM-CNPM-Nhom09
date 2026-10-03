const crypto = require('crypto');
const { AppError } = require('../../utils/errors');

function createPaymentService({
  prisma,
  fee,
  clock = () => new Date(),
  genTxnRef = () => `TS${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
}) {
  async function create(user, applicationId, { method }) {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ');
    if (app.candidateId !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thanh toán cho hồ sơ này');
    }
    if (app.status === 'DRAFT') {
      throw new AppError(409, 'APPLICATION_NOT_SUBMITTED', 'Cần nộp hồ sơ trước khi thanh toán');
    }
    if (app.status === 'REJECTED') {
      throw new AppError(409, 'INVALID_STATE', 'Hồ sơ đã bị từ chối');
    }
    const open = await prisma.payment.findFirst({
      where: { applicationId, status: { in: ['PENDING', 'PAID'] } },
    });
    if (open) throw new AppError(409, 'PAYMENT_EXISTS', 'Hồ sơ đã có giao dịch đang chờ hoặc đã thanh toán');
    return prisma.payment.create({
      data: { applicationId, amount: fee, method, status: 'PENDING', txnRef: genTxnRef() },
    });
  }

  // Xác nhận thanh toán thủ công (STAFF/ADMIN). Thay bằng webhook cổng thanh toán khi tích hợp thật.
  async function confirm(paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Không tìm thấy giao dịch');
    if (payment.status !== 'PENDING') {
      throw new AppError(409, 'INVALID_STATE', `Giao dịch đang ở trạng thái ${payment.status}`);
    }
    return prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'PAID', paidAt: clock() },
    });
  }

  return { create, confirm };
}

module.exports = { createPaymentService };
