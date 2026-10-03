import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  // /health ngoài prefix (Docker); API nghiệp vụ dưới /api/v1
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API    http://localhost:${port}/api/v1`);
  console.log(`Health http://localhost:${port}/health`);
}

bootstrap();
