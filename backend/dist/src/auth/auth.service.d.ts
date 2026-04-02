import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
export declare class AuthService {
    private prisma;
    private jwtService;
    private ledger;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService, ledger: LedgerService);
    login(email: string, password: string, ipAddress: string, userAgent: string): Promise<{
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
    verifyMfa(userId: string, orgId: string, totpCode: string, sessionId: string): Promise<{
        accessToken: string;
    }>;
    logout(userId: string, sessionId: string, ipAddress: string): Promise<{
        message: string;
    }>;
    private generateToken;
    private createSession;
}
