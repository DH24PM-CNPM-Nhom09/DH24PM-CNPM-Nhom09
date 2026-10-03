import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  toAdmissionStatus,
  toReviewStatus,
  toSupervisorStatus,
} from '../../common/mappers/status.mapper';

const MAX_FILE_KB = 5120;
const ALLOWED_DOC_TYPES = new Set([
  'VAN_BANG',
  'BANG_DIEM',
  'CHUNG_CHI_NGOAI_NGU',
  'DE_CUONG_NCS',
  'THU_GIOI_THIEU',
  'CONG_BO_KHOA_HOC',
  'KHAC',
]);

@Injectable()
export class ApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCandidateId(user: JwtPayload): Promise<bigint> {
    if (user.type !== 'CANDIDATE') {
      throw new ForbiddenException({
        error_code: 'FORBIDDEN',
        message: 'Chỉ tài khoản thí sinh',
      });
    }
    const candidate = await this.prisma.candidate.findUnique({
      where: { accountId: BigInt(user.id) },
    });
    if (!candidate) {
      throw new NotFoundException({
        error_code: 'CANDIDATE_NOT_FOUND',
        message: 'Chưa có hồ sơ thí sinh',
      });
    }
    return candidate.candidateId;
  }

  /**
   * GET /applications/me → Application | null (1 object)
   */
  async getMyApplication(user: JwtPayload) {
    const candidateId = await this.resolveCandidateId(user);

    const app = await this.prisma.application.findFirst({
      where: { candidateId, isCancelled: false },
      orderBy: { createdAt: 'desc' },
      include: {
        batchMajor: {
          include: { batch: true, major: true },
        },
      },
    });

    if (!app) return null;

    const degreeRaw = app.batchMajor.batch.degreeLevel || app.batchMajor.major.degreeLevel;
    const degreeLevel =
      degreeRaw === 'TIEN_SI' || degreeRaw === 'PhD' ? 'TIEN_SI' : 'THAC_SI';

    return {
      applicationId: Number(app.applicationId),
      applicationCode: app.applicationCode,
      reviewStatus: toReviewStatus(app.reviewStatus),
      admissionStatus: toAdmissionStatus(app.admissionStatus),
      batchName:
        app.batchMajor.batch.batchName ??
        app.batchMajor.batch.batchCode ??
        'Đợt tuyển sinh',
      majorName:
        app.batchMajor.major.majorName ??
        app.batchMajor.major.majorCode ??
        'Ngành',
      degreeLevel,
      submittedAt: app.createdAt?.toISOString() ?? null,
    };
  }

  /**
   * GET /applications/me/documents → ApplicationDocument[]
   */
  async getMyDocuments(user: JwtPayload) {
    const candidateId = await this.resolveCandidateId(user);

    const app = await this.prisma.application.findFirst({
      where: { candidateId, isCancelled: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!app) return [];

    const docs = await this.prisma.applicationDocument.findMany({
      where: { applicationId: app.applicationId },
      orderBy: { documentId: 'asc' },
    });

    return docs.map((d) => ({
      documentId: Number(d.documentId),
      documentType: d.documentType,
      fileName: d.fileName || `${d.documentType}.bin`,
      fileSizeKb: d.fileSizeKb,
      verifyStatus: (d.verifyStatus as 'PENDING' | 'VALID' | 'INVALID') || 'PENDING',
    }));
  }

  /**
   * POST /applications/:id/documents — multipart file + documentType
   */
  async uploadDocument(
    user: JwtPayload,
    applicationId: bigint,
    file: Express.Multer.File | undefined,
    documentType: string,
  ) {
    if (!file) {
      throw new BadRequestException({
        error_code: 'FILE_REQUIRED',
        message: 'Vui lòng chọn file để tải lên',
      });
    }

    if (!ALLOWED_DOC_TYPES.has(documentType)) {
      throw new BadRequestException({
        error_code: 'INVALID_DOCUMENT_TYPE',
        message: 'Loại minh chứng không hợp lệ',
      });
    }

    const sizeKb = Math.ceil(file.size / 1024);
    if (sizeKb > MAX_FILE_KB) {
      throw new BadRequestException({
        error_code: 'FILE_TOO_LARGE',
        message: 'File vượt quá 5MB, vui lòng chọn file khác.',
      });
    }

    const candidateId = await this.resolveCandidateId(user);
    const app = await this.prisma.application.findFirst({
      where: { applicationId, candidateId },
    });
    if (!app) {
      throw new ForbiddenException({
        error_code: 'APPLICATION_NOT_OWNED',
        message: 'Hồ sơ không thuộc về bạn',
      });
    }

    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    fs.mkdirSync(uploadDir, { recursive: true });
    const safeName = `${applicationId}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const diskPath = path.join(uploadDir, safeName);
    fs.writeFileSync(diskPath, file.buffer);

    const document = await this.prisma.applicationDocument.create({
      data: {
        applicationId,
        documentType,
        fileHash,
        fileSizeKb: sizeKb,
        fileName: file.originalname,
        verifyStatus: 'PENDING',
      },
    });

    return {
      success: true,
      documentId: Number(document.documentId),
      fileName: document.fileName,
      fileSizeKb: document.fileSizeKb,
    };
  }

  /**
   * GET /applications/me/supervisor-request → SupervisorRequest | null
   */
  async getMySupervisorRequest(user: JwtPayload) {
    const candidateId = await this.resolveCandidateId(user);

    const app = await this.prisma.application.findFirst({
      where: { candidateId, isCancelled: false },
      orderBy: { createdAt: 'desc' },
      include: {
        researchProposal: {
          include: {
            supervisorRequests: {
              orderBy: { requestId: 'desc' },
              take: 1,
              include: { lecturer: true },
            },
          },
        },
      },
    });

    const req = app?.researchProposal?.supervisorRequests?.[0];
    if (!req) return null;

    return {
      requestId: Number(req.requestId),
      lecturerName: req.lecturer.fullName ?? req.lecturer.lecturerCode,
      facultyName: req.lecturer.facultyName ?? '',
      status: toSupervisorStatus(req.status),
      requestedAt: req.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
