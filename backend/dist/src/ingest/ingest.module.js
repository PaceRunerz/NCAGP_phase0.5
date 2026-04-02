"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestModule = void 0;
const common_1 = require("@nestjs/common");
const ingest_service_1 = require("./ingest.service");
const ingest_controller_1 = require("./ingest.controller");
const ledger_module_1 = require("../ledger/ledger.module");
const apikeys_module_1 = require("../apikeys/apikeys.module");
let IngestModule = class IngestModule {
};
exports.IngestModule = IngestModule;
exports.IngestModule = IngestModule = __decorate([
    (0, common_1.Module)({
        imports: [ledger_module_1.LedgerModule, apikeys_module_1.ApiKeysModule],
        providers: [ingest_service_1.IngestService],
        controllers: [ingest_controller_1.IngestController],
    })
], IngestModule);
//# sourceMappingURL=ingest.module.js.map