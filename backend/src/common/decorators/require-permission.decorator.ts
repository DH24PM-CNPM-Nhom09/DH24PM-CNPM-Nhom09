import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

/**
 * Vi du su dung tren controller:
 *   @RequirePermission('application:review')
 *   @Patch(':id/review')
 *   reviewApplication(...) {}
 */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
