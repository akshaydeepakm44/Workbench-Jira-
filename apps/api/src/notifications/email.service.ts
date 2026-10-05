import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<number>('SMTP_PORT')) || 587;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`SMTP Email Transporter initialized with host: ${host}:${port}`);
    } else {
      this.logger.warn('SMTP credentials not fully configured in .env. Emails will be logged to system audit & console.');
    }
  }

  async sendMail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    templateName?: string;
  }) {
    const from = this.configService.get<string>('SMTP_FROM') || '"WorkDesk Platform" <notifications@workdesk.internal>';

    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text || params.subject,
        });
        this.logger.log(`Email successfully dispatched via SMTP to ${params.to}`);
      } else {
        this.logger.log(`
===================== [WORKDESK OUTGOING EMAIL DISPATCH] =====================
To: ${params.to}
From: ${from}
Subject: ${params.subject}
Template: ${params.templateName || 'GENERIC'}
Content:
${params.text || params.subject}
==============================================================================`);
      }

      await this.prisma.emailLog.create({
        data: {
          recipient: params.to,
          subject: params.subject,
          templateName: params.templateName || 'GENERIC',
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      return { success: true };
    } catch (err: any) {
      this.logger.error(`Failed to dispatch email to ${params.to}: ${err.message}`);
      await this.prisma.emailLog.create({
        data: {
          recipient: params.to,
          subject: params.subject,
          templateName: params.templateName || 'GENERIC',
          status: 'FAILED',
          errorMessage: err.message,
        },
      });
      return { success: false, error: err.message };
    }
  }

  async sendAccessRequestEmail(user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string | null;
  }) {
    const superAdminEmail = this.configService.get<string>('SUPER_ADMIN_EMAIL') || 'akshay.m@datai2i.com';
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:5174';
    const approveUrl = `${appUrl}/admin/super?approveUser=${user.id}`;

    const subject = `Someone is trying to get in: See and accept!! (${user.fullName})`;
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #6366f1; margin: 0; font-size: 24px;">WorkDesk Super Admin Alert</h2>
          <p style="color: #f59e0b; font-size: 16px; font-weight: bold; margin-top: 8px;">Someone is trying to get in: See and accept!!</p>
        </div>
        
        <div style="background-color: #0f172a; padding: 20px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 24px;">
          <p style="margin: 0 0 14px 0; font-size: 14px; color: #cbd5e1;">A user has registered via Google Workspace and is requesting access to the platform:</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="color: #94a3b8; padding: 6px 0; width: 130px;"><strong>Full Name:</strong></td>
              <td style="color: #ffffff; padding: 6px 0; font-weight: 600;">${user.fullName}</td>
            </tr>
            <tr>
              <td style="color: #94a3b8; padding: 6px 0;"><strong>Corporate Email:</strong></td>
              <td style="color: #38bdf8; font-family: monospace; padding: 6px 0;">${user.email}</td>
            </tr>
            <tr>
              <td style="color: #94a3b8; padding: 6px 0;"><strong>Registration Time:</strong></td>
              <td style="color: #ffffff; padding: 6px 0;">${new Date().toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color: #94a3b8; padding: 6px 0;"><strong>Status:</strong></td>
              <td style="color: #f59e0b; padding: 6px 0; font-weight: bold;">PENDING APPROVAL</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${approveUrl}" style="background-color: #6366f1; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
            See and Accept User Details &rarr;
          </a>
        </div>

        <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0; line-height: 1.5;">
          Clicking above will open the Super Admin Dashboard and present this user's details for immediate verification and Employee ID assignment.
        </p>
      </div>
    `;

    return this.sendMail({
      to: superAdminEmail,
      subject,
      html,
      text: `Someone is trying to get in: See and accept!! User ${user.fullName} (${user.email}) requested access. Review at: ${approveUrl}`,
      templateName: 'ACCESS_REQUEST_NOTIFICATION',
    });
  }

  async sendAccountApprovedEmail(params: {
    to: string;
    fullName: string;
    employeeId: string;
    roleName: string;
  }) {
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:5174';
    const loginUrl = `${appUrl}/login`;

    const subject = `Welcome to WorkDesk! Your Account Has Been Approved`;
    const html = `
      <div style="font-family: Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #10b981; margin: 0; font-size: 24px;">Account Approved!</h2>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 6px;">Your WorkDesk workspace is now active</p>
        </div>
        
        <div style="background-color: #0f172a; padding: 20px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 24px;">
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #cbd5e1;">Hello <strong>${params.fullName}</strong>,</p>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #94a3b8;">Your registration has been reviewed and accepted by the organization administrator. Here are your credentials:</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="color: #94a3b8; padding: 6px 0; width: 130px;"><strong>Assigned ID:</strong></td>
              <td style="color: #10b981; font-family: monospace; font-weight: bold; padding: 6px 0;">${params.employeeId}</td>
            </tr>
            <tr>
              <td style="color: #94a3b8; padding: 6px 0;"><strong>System Role:</strong></td>
              <td style="color: #ffffff; padding: 6px 0;">${params.roleName}</td>
            </tr>
            <tr>
              <td style="color: #94a3b8; padding: 6px 0;"><strong>Status:</strong></td>
              <td style="color: #10b981; padding: 6px 0; font-weight: bold;">ACTIVE & AUTHORIZED</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${loginUrl}" style="background-color: #10b981; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);">
            Access Your Workspace &rarr;
          </a>
        </div>
      </div>
    `;

    return this.sendMail({
      to: params.to,
      subject,
      html,
      text: `Hello ${params.fullName}, your WorkDesk account is approved. Employee ID: ${params.employeeId}. Access your dashboard at ${loginUrl}`,
      templateName: 'ACCOUNT_APPROVED_NOTIFICATION',
    });
  }
}

