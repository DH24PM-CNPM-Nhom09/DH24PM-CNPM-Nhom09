import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { asStaff, CurrentUser, Public, type AuthUser } from "../../common/auth";
import { str } from "../../common/util";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ---- Cán bộ (phân hệ Quản lý)
  @Public()
  @Post("staff/login")
  @HttpCode(200)
  staffLogin(@Body() body: Record<string, unknown>) {
    return this.auth.staffLogin(str(body.email), str(body.password));
  }

  @Public()
  @Post("staff/google")
  @HttpCode(200)
  staffGoogle(@Body() body: Record<string, unknown>) {
    return this.auth.staffGoogle(str(body.idToken));
  }

  @Get("staff/me")
  staffMe(@CurrentUser() user: AuthUser) {
    return this.auth.staffMe(asStaff(user).staffAccountId);
  }

  // ---- Thí sinh
  @Public()
  @Post("google")
  @HttpCode(200)
  candidateGoogle(@Body() body: Record<string, unknown>) {
    return this.auth.candidateGoogle(str(body.idToken));
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  candidateLogin(@Body() body: Record<string, unknown>) {
    return this.auth.candidateLogin(str(body.emailOrPhone ?? body.email), str(body.password));
  }

  @Public()
  @Post("register")
  @HttpCode(200)
  register(@Body() body: Record<string, unknown>) {
    return this.auth.register(body);
  }

  @Public()
  @Post("register/verify")
  @HttpCode(200)
  verifyRegister(@Body() body: Record<string, unknown>) {
    return this.auth.verifyRegister(str(body.email), str(body.otp));
  }

  @Public()
  @Post("register/resend")
  @HttpCode(200)
  resendRegister(@Body() body: Record<string, unknown>) {
    return this.auth.resendRegister(str(body.email));
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(200)
  forgot(@Body() body: Record<string, unknown>) {
    return this.auth.forgotPassword(str(body.emailOrPhone));
  }

  @Public()
  @Post("reset-password")
  @HttpCode(200)
  reset(@Body() body: Record<string, unknown>) {
    return this.auth.resetPassword(str(body.emailOrPhone), str(body.otp), str(body.newPassword));
  }
}
