import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { CandidateAccountController } from './controllers/candidate-account.controller';
import { AuthService } from './services/auth.service';
import { OtpService } from './services/otp.service';
import { CandidateAccountService } from './services/candidate-account.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
    }),
  ],
  controllers: [AuthController, CandidateAccountController],
  providers: [AuthService, OtpService, CandidateAccountService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthAccountModule {}
