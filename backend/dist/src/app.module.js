"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const ledger_module_1 = require("./ledger/ledger.module");
const findings_module_1 = require("./findings/findings.module");
const evidence_module_1 = require("./evidence/evidence.module");
const storage_module_1 = require("./storage/storage.module");
const organizations_module_1 = require("./organizations/organizations.module");
const assets_module_1 = require("./assets/assets.module");
const rls_interceptor_1 = require("./rls/rls.interceptor");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot([
                { ttl: 60000, limit: 100 },
            ]),
            prisma_module_1.PrismaModule,
            storage_module_1.StorageModule,
            auth_module_1.AuthModule,
            ledger_module_1.LedgerModule,
            organizations_module_1.OrganizationsModule,
            assets_module_1.AssetsModule,
            findings_module_1.FindingsModule,
            evidence_module_1.EvidenceModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
            { provide: core_1.APP_INTERCEPTOR, useClass: rls_interceptor_1.RlsInterceptor },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map