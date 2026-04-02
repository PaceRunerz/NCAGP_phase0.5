import { PrismaService } from '../prisma/prisma.service';
export declare class ReportsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    generateNationalRiskReport(): Promise<Buffer>;
    private buildPDF;
}
