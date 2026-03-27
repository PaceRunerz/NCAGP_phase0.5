"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = exports.RequireOrgScope = exports.Roles = exports.ORG_SCOPE_KEY = exports.ROLES_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.ROLES_KEY = 'roles';
exports.ORG_SCOPE_KEY = 'orgScope';
const Roles = (...roles) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roles);
exports.Roles = Roles;
const RequireOrgScope = () => (0, common_1.SetMetadata)(exports.ORG_SCOPE_KEY, true);
exports.RequireOrgScope = RequireOrgScope;
const common_2 = require("@nestjs/common");
exports.CurrentUser = (0, common_2.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
});
//# sourceMappingURL=roles.decorator.js.map