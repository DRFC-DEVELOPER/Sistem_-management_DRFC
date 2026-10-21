import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ErroresBdFilter } from './common/filters/errores-bd.filter';
import { validacion } from './common/validacion';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.use(helmet());

  const origenes = (process.env.CORS_ORIGEN || '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origenes.length ? origenes : false });

  app.useGlobalPipes(validacion());
  app.useGlobalFilters(new ErroresBdFilter(app.get(HttpAdapterHost).httpAdapter));

  if (process.env.SWAGGER !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('Inventario de equipos')
      .setDescription('API para equipos, empleados, asignaciones y reparaciones')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config), {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}
bootstrap();
