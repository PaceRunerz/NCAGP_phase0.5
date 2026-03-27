import { UserRole } from '@prisma/client';
export declare const ROLES_KEY = "roles";
export declare const ORG_SCOPE_KEY = "orgScope";
export declare const Roles: (...roles: UserRole[]) => import("@nestjs/common").CustomDecorator<string>;
export declare const RequireOrgScope: () => import("@nestjs/common").CustomDecorator<string>;
export declare const CurrentUser: (...dataOrPipes: (string | import("@nestjs/common").PipeTransform<any, any> | import("@nestjs/common").Type<import("@nestjs/common").PipeTransform<any, any>> | undefined)[]) => ParameterDecorator;
