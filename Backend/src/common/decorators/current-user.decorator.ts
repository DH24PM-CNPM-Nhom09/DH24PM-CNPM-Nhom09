import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtPayload = {
  id: string;
  type: 'STAFF' | 'CANDIDATE';
  roleCodes: string[];
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    return ctx.switchToHttp().getRequest().user;
  },
);
