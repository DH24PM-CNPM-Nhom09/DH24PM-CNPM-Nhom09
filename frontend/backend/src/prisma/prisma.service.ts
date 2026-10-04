import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

/** Kiểu client dùng trong transaction (prisma.$transaction(async (tx) => …)) */
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
