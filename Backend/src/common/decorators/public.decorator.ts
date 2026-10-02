import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'is_public';

/**
 * Danh dau route KHONG yeu cau dang nhap (vd: login, register, health).
 * JwtAuthGuard (global) se bo qua kiem tra token cho route co decorator nay.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
