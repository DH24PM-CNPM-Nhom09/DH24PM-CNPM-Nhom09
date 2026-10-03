import { ForbiddenException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DOMAIN_EVENTS, ResultPublishedEvent } from '../../common/events/domain-events';

/**
 * RankingService (theo tai lieu thiet ke GD3, muc 2.6) - phan nghiep vu
 * phuc tap nhat, can Team Lead / giang vien xac nhan tieu chi tie-break
 * truoc khi ap dung thuc te.
 */
@Injectable()
export class AdmissionResultService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2) {}

  /**
   * Buoc 1: xay dung bang xep hang theo tong diem giam dan.
   * Tie-break (dong diem): tam thoi sap theo applicationId tang dan
   * (thi sinh nop som hon dung applicationId nho hon) - CAN THAY BANG
   * tieu chi chinh thuc sau khi thong nhat voi Team Lead / de bai.
   */
  async buildRanking(batchMajorId: bigint) {
    const applications = await this.prisma.application.findMany({
      where: { batchMajorId, reviewStatus: 'HOP_LE' },
      include: { examScores: { include: { subject: true } } },
    });

    const scored = applications.map((app) => {
      const totalScore = app.examScores.reduce(
        (sum, s) => sum + Number(s.score) * Number(s.subject.weight),
        0,
      );
      return { applicationId: app.applicationId, totalScore };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore || Number(a.applicationId - b.applicationId));

    await this.prisma.$transaction(
      scored.map((item, index) =>
        this.prisma.applicationRanking.upsert({
          where: { applicationId: item.applicationId },
          create: { applicationId: item.applicationId, totalScore: item.totalScore, rankOrder: index + 1 },
          update: { totalScore: item.totalScore, rankOrder: index + 1 },
        }),
      ),
    );

    return { rankedCount: scored.length };
  }

  /**
   * Buoc 2: so sanh voi diem chuan + quota -> TRUNG_TUYEN / CHO_XET (waitlist)
   * / KHONG_TRUNG_TUYEN.
   */
  async applyBenchmark(batchMajorId: bigint) {
    const batchMajor = await this.prisma.admissionBatchMajor.findUniqueOrThrow({ where: { batchMajorId } });
    const benchmark = await this.prisma.admissionBenchmark.findUniqueOrThrow({ where: { batchMajorId } });

    const rankings = await this.prisma.applicationRanking.findMany({
      where: { application: { batchMajorId } },
      orderBy: { rankOrder: 'asc' },
    });

    let admittedCount = 0;

    for (const ranking of rankings) {
      const meetsBenchmark = Number(ranking.totalScore) >= Number(benchmark.benchmarkValue);

      if (!meetsBenchmark) {
        await this.prisma.admissionResult.upsert({
          where: { applicationId: ranking.applicationId },
          create: { applicationId: ranking.applicationId, result: 'KHONG_TRUNG_TUYEN' },
          update: { result: 'KHONG_TRUNG_TUYEN' },
        });
        continue;
      }

      if (admittedCount < batchMajor.quota) {
        admittedCount += 1;
        await this.prisma.admissionResult.upsert({
          where: { applicationId: ranking.applicationId },
          create: { applicationId: ranking.applicationId, result: 'TRUNG_TUYEN' },
          update: { result: 'TRUNG_TUYEN' },
        });
      } else {
        await this.prisma.waitlist.upsert({
          where: { applicationId: ranking.applicationId },
          create: { applicationId: ranking.applicationId, status: 'CHO_XET' },
          update: { status: 'CHO_XET' },
        });
      }
    }

    return { admittedCount, totalConsidered: rankings.length };
  }

  /**
   * Duyet ket qua 2 cap (Hoi dong -> Lanh dao) roi moi cong bo (published_at).
   */
  async approveLevel1(applicationId: bigint, staffId: bigint) {
    return this.prisma.admissionResult.update({
      where: { applicationId },
      data: { approvedByStaffId: staffId },
    });
  }

  async approveLevel2AndPublish(applicationId: bigint, leaderId: bigint) {
    const result = await this.prisma.admissionResult.findUniqueOrThrow({ where: { applicationId } });
    if (!result.approvedByStaffId) {
      throw new ForbiddenException('Ket qua chua duoc Hoi dong tuyen sinh duyet o cap 1');
    }

    const published = await this.prisma.admissionResult.update({
      where: { applicationId },
      data: { approvedByLeaderId: leaderId, publishedAt: new Date() },
    });

    this.events.emit(DOMAIN_EVENTS.RESULT_PUBLISHED, new ResultPublishedEvent(applicationId, published.result));
    return published;
  }

  /**
   * Thang du bi khi co thi sinh trung tuyen huy nhap hoc.
   * Chay trong 1 transaction de tranh thang du quota khi 2 request chay
   * dong thoi (goi tu event EnrollmentWithdrawnEvent, module decision-enrollment).
   */
  async promoteFromWaitlist(batchMajorId: bigint, quotaGap: number) {
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.waitlist.findMany({
        where: { status: 'CHO_XET', application: { batchMajorId } },
        include: { application: { include: { ranking: true } } },
        orderBy: { application: { ranking: { rankOrder: 'asc' } } },
        take: quotaGap,
      });

      for (const item of candidates) {
        await tx.waitlist.update({ where: { waitlistId: item.waitlistId }, data: { status: 'DA_THANG' } });
        await tx.admissionResult.upsert({
          where: { applicationId: item.applicationId },
          create: { applicationId: item.applicationId, result: 'TRUNG_TUYEN' },
          update: { result: 'TRUNG_TUYEN' },
        });
      }

      return { promotedCount: candidates.length };
    });
  }
}
