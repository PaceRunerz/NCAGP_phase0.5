import { IsEmail, IsString, MinLength, IsIn, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Optional — if not sent, CAPTCHA check is skipped in dev
  @IsOptional()
  @IsString()
  recaptchaToken?: string;

  @IsOptional()
  @IsIn(['v2', 'v3'])
  recaptchaVersion?: 'v2' | 'v3';
}