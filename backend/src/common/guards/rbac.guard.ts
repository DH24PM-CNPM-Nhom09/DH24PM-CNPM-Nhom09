import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { hasPermission } from '../constants/permission-matrix';

/**
 * RbacGuard - kiem tra quyen theo PERMISSION_MATRIX (xem constants/permission-matrix.ts).
 * Chi ap dung cho staff (candidate khong co roleCodes).
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.get<string>(PERMISSION_KEY, context.getHandler());
    if (!requiredPermission) return true; // route khong yeu cau quyen rieng

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.type !== 'STAFF') {
      throw new ForbiddenException('Chi tai khoan can bo moi duoc phep thuc hien hanh dong nay');
    }

    if (!hasPermission(user.roleCodes ?? [], requiredPermission)) {
      throw new ForbiddenException(`Tai khoan khong co quyen '${requiredPermission}'`);
    }

    return true;
  }
}
