import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DOMAIN_EVENTS, ScoreChangedEvent } from '../../common/events/domain-events';

@Injectable()
export class ExamService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2) {}

  /**
   * Xep phong thi tu dong (bin-packing don gian):
   * sap thi sinh theo thu tu application_code, lap day tung phong den
   * capacity roi moi sang phong ke tiep. Idempotent: bo qua ho so da co
   * exam_assignment.
   */
  async autoAssignRoom(batchId: bigint) {
    const rooms = await this.prisma.examRoom.findMany({ where: { batchId }, orderBy: { roomId: 'asc' } });
    const applications = await this.prisma.application.findMany({
      where: { batchMajor: { batchId }, examAssignment: null, reviewStatus: 'HOP_LE' },
      orderBy: { applicationCode: 'asc' },
    });

    const assignments: { applicationId: bigint; roomId: bigint; sbdCode: string }[] = [];
    let roomIndex = 0;
    let seatInRoom = 0;
    let sequence = 1;

    for (const application of applications) {
      if (roomIndex >= rooms.length) break; // het phong, con lai xu ly thu cong
      const room = rooms[roomIndex];

      assignments.push({
        applicationId: application.applicationId,
        roomId: room.roomId,
        sbdCode: `${application.batchMajorId}-${String(sequence).padStart(4, '0')}`,
      });

      seatInRoom += 1;
      sequence += 1;
      if (seatInRoom >= room.capacity) {
        roomIndex += 1;
        seatInRoom = 0;
      }
    }

    await this.prisma.examAssignment.createMany({ data: assignments, skipDuplicates: true });
    return { assignedCount: assignments.length, unassignedCount: applications.length - assignments.length };
  }

  enterScore(applicationId: bigint, subjectId: bigint, graderStaffId: bigint, score: number) {
    return this.prisma.examScore.create({ data: { applicationId, subjectId, graderStaffId, score } });
  }

  /**
   * Tong diem co trong so = SUM(exam_score.score * exam_subject.weight).
   */
  async calculateTotalScore(applicationId: bigint): Promise<number> {
    const scores = await this.prisma.examScore.findMany({
      where: { applicationId },
      include: { subject: true },
    });
    return scores.reduce((sum, s) => sum + Number(s.score) * Number(s.subject.weight), 0);
  }

  /**
   * Phuc khao: giu lai old_score/new_score trong score_appeal, KHONG sua
   * truc tiep exam_score.score sau khi da co phuc khao - phai bao event de
   * module admission-result tinh lai xep hang.
   */
  async resolveAppeal(scoreId: bigint, newScore: number) {
    const score = await this.prisma.examScore.findUniqueOrThrow({ where: { scoreId } });

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.scoreAppeal.create({
        data: { scoreId, oldScore: score.score, newScore, status: 'DA_XU_LY' },
      });
      return tx.examScore.update({ where: { scoreId }, data: { score: newScore } });
    });

    this.events.emit(
      DOMAIN_EVENTS.SCORE_CHANGED,
      new ScoreChangedEvent(score.applicationId, 0n /* TODO: lay batchMajorId tu application */),
    );

    return result;
  }
}
