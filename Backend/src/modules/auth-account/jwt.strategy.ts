import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    });
  }

  validate(payload: { id: string; type: 'STAFF' | 'CANDIDATE'; roleCodes?: string[] }) {
    if (!payload?.id || !payload?.type) {
      throw new UnauthorizedException({
        error_code: 'INVALID_TOKEN',
        message: 'Token không hợp lệ',
      });
    }
    return { id: payload.id, type: payload.type, roleCodes: payload.roleCodes ?? [] };
  }
}
