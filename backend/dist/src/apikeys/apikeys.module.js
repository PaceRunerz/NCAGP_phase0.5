"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeysModule = void 0;
const common_1 = require("@nestjs/common");
const apikeys_service_1 = require("./apikeys.service");
const apikeys_controller_1 = require("./apikeys.controller");
const ledger_module_1 = require("../ledger/ledger.module");
let ApiKeysModule = class ApiKeysModule {
};
exports.ApiKeysModule = ApiKeysModule;
exports.ApiKeysModule = ApiKeysModule = __decorate([
    (0, common_1.Module)({
        imports: [ledger_module_1.LedgerModule],
        providers: [apikeys_service_1.ApiKeysService],
        controllers: [apikeys_controller_1.ApiKeysController],
        exports: [apikeys_service_1.ApiKeysService],
    })
], ApiKeysModule);
//# sourceMappingURL=apikeys.module.js.map