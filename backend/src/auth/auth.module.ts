import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtAuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { CmsUser, CmsUserSchema } from 'src/schemas/cms-user.schema';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JOSE_SECRET,
    }),
    MongooseModule.forFeature([{ name: CmsUser.name, schema: CmsUserSchema }]),
  ],
  providers: [JwtAuthGuard, JwtService, RolesGuard],
  exports: [JwtAuthGuard, JwtService, RolesGuard],
})
export class AuthModule {}
