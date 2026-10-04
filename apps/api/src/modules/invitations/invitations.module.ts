import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AcceptInvitationController } from './controllers/accept-invitation.controller.js';
import { InvitationsController } from './controllers/invitations.controller.js';
import { InvitationsService } from './services/invitations.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InvitationsController, AcceptInvitationController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
