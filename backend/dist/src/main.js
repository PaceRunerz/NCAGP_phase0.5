"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const helmet_1 = require("helmet");
const logger = new common_1.Logger('Bootstrap');
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['log', 'warn', 'error', 'debug'],
    });
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'blob:'],
            },
        },
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }));
    app.enableCors({
        origin: process.env.FRONTEND_URL || 'http://localhost:3001',
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Authorization', 'Content-Type'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.setGlobalPrefix('api');
    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(`🛡️  NCAGP API running on: http://localhost:${port}/api`);
    logger.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap().catch((err) => {
    logger.error('Failed to start application', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map