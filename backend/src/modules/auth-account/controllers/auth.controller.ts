import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { Public } from '../../../common/decorators/public.decorator';
import { LoginDto } from '../dto/login.dto';
import { GoogleLoginDto } from '../dto/google-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  loginStaff(@Body() dto: LoginDto) {
    return this.authService.loginStaff(dto);
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  loginWithGoogle(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto);
  }
}
