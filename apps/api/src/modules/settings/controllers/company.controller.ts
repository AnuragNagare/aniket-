import { Body, Controller, Get, Patch } from '@nestjs/common';
import { type CompanyDto, type UpdateCompanyInput, UpdateCompanySchema } from '@worktrail/types';
import { ZodBody } from '../../../common/pipes/zod-body.pipe.js';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { CompanySettingsService } from '../services/company-settings.service.js';

@Roles('OWNER', 'ADMIN')
@Controller('company')
export class CompanyController {
  constructor(private readonly companySettings: CompanySettingsService) {}

  @Get()
  getCompany(@CurrentAuth() auth: AuthContext): Promise<CompanyDto> {
    return this.companySettings.get(auth);
  }

  @Patch()
  updateCompany(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodBody(UpdateCompanySchema)) body: UpdateCompanyInput,
  ): Promise<CompanyDto> {
    return this.companySettings.update(auth, body);
  }
}
