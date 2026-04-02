"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgScopeGuard = exports.RolesGuard = exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const passport_1 = require("@nestjs/passport");
const roles_decorator_1 = require("../roles.decorator");
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    constructor(reflector) {
        super();
        this.reflector = reflector;
    }
    canActivate(context) {
        return super.canActivate(context);
    }
    handleRequest(err, user, info) {
        if (err || !user) {
            throw err || new common_1.UnauthorizedException('Authentication required');
        }
        if (user.role !== 'OBSERVER' && !user.mfaVerified) {
            throw new common_1.UnauthorizedException('MFA verification required');
        }
        return user;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], JwtAuthGuard);
let RolesGuard = class RolesGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const requiredRoles = this.reflector.getAllAndOverride(roles_decorator_1.ROLES_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredRoles)
            return true;
        const { user } = context.switchToHttp().getRequest();
        if (!user)
            throw new common_1.UnauthorizedException();
        const hasRole = requiredRoles.some((role) => user.role === role);
        if (!hasRole) {
            throw new common_1.ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
        }
        return true;
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], RolesGuard);
let OrgScopeGuard = class OrgScopeGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const { user, params, query, body } = request;
        if (!user)
            throw new common_1.UnauthorizedException();
        if (user.role === 'NIC_ADMIN')
            return true;
        const targetOrgId = params?.orgId ||
            query?.orgId ||
            body?.orgId;
        if (!targetOrgId)
            return true;
        if (!user.dataAccessScope.includes(targetOrgId) && user.orgId !== targetOrgId) {
            throw new common_1.ForbiddenException('Access denied: This resource belongs to a different organization');
        }
        request.resolvedOrgId = targetOrgId;
        return true;
    }
};
exports.OrgScopeGuard = OrgScopeGuard;
exports.OrgScopeGuard = OrgScopeGuard = __decorate([
    (0, common_1.Injectable)()
], OrgScopeGuard);
//# sourceMappingURL=auth.guard.js.map