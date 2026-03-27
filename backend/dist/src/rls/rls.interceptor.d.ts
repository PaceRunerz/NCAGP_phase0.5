import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
export declare class RlsInterceptor implements NestInterceptor {
    private prisma;
    constructor(prisma: PrismaService);
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>>;
}
