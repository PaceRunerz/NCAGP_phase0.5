import { Request } from 'express';
import { AuthService } from './auth.service';
declare class LoginDto {
    email: string;
    password: string;
}
declare class MfaDto {
    totpCode: string;
}
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(dto: LoginDto, req: Request): Promise<{
        accessToken: string;
        requiresMfa: boolean;
        user: {
            id: string;
            name: string;
            email: string;
            role: import(".prisma/client").$Enums.UserRole;
            orgId: string;
            orgName: string;
        };
    }>;
    verifyMfa(dto: MfaDto, user: any): Promise<{
        accessToken: string;
    }>;
    logout(user: any, req: Request): Promise<{
        message: string;
    }>;
}
export {};
