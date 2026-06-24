import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
export declare class AlertsService implements OnModuleInit {    sfv
    private prisma;
    private config;
    private readonly logger;
    private transporter;
    private intervalId;
    constructor(prisma: PrismaService, config: ConfigService);
    onModuleInit(): void;
    runAlertCheck(): Promise<void>;
    private getBreachers;
    private getWarnings;
    private wasAlreadySent;
    private markSent;
    private sendBreachAlert;
    private sendWarningAlert;
    private buildBreachEmail;
    private buildWarningEmail;
}
