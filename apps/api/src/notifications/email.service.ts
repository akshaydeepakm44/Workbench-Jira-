import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private etherealUser: string | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.initPromise = this.initTransporter();
    await this.initPromise;
  }

  private async initTransporter(): Promise<void> {
    const service = this.configService.get<string>('SMTP_SERVICE');
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<number>('SMTP_PORT')) || 587;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (user && pass) {
      const cleanPass = pass.replace(/\s+/g, '');
      const cleanUser = user.trim();

      if (service?.toLowerCase() === 'gmail' || host?.includes('gmail') || cleanUser.endsWith('@gmail.com')) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: cleanUser,
            pass: cleanPass,
          },
        });
        this.logger.log(`Real Gmail SMTP Email Transporter configured for: ${cleanUser}`);
      } else {
        const smtpHost = host || 'smtp.gmail.com';
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port,
          secure: port === 465,
          auth: { user: cleanUser, pass: cleanPass },
          tls: { rejectUnauthorized: false },
        });
        this.logger.log(`Real SMTP Email Transporter configured with host: ${smtpHost}:${port} for ${cleanUser}`);
      }

      try {
        await this.transporter.verify();
        this.logger.log(`✅ SMTP connection verified successfully with mail server! Real emails will be delivered.`);
      } catch (verifyErr: any) {
        this.logger.error(`❌ SMTP Connection verification failed: ${verifyErr.message}`);
        this.logger.warn(`Note: For Gmail, ensure 2-Factor Authentication is enabled and use a 16-character 'App Password' from https://myaccount.google.com/apppasswords`);
      }
    } else {
      try {
        this.logger.log('No SMTP_USER / SMTP_PASS configured in .env. Provisioning automated Ethereal fallback...');
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.etherealUser = testAccount.user;
        this.logger.log(`Automated Ethereal fallback initialized (${testAccount.user})`);
      } catch (err: any) {
        this.logger.warn(`Could not provision Ethereal SMTP account: ${err.message}. Outbound emails will log to console.`);
      }
    }
  }

  async sendMail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    templateName?: string;
  }): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
    if (!this.transporter && this.initPromise) {
      await this.initPromise;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER') || this.etherealUser;
    const defaultFrom = user ? `"WorkDesk Platform" <${user}>` : '"WorkDesk Platform" <notifications@workdesk.internal>';
    const from = this.configService.get<string>('SMTP_FROM') || defaultFrom;

    try {
      let previewUrl: string | undefined = undefined;
      if (this.transporter) {
        const info = await this.transporter.sendMail({
          from,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text || params.subject,
        });
        const url = nodemailer.getTestMessageUrl(info);
        if (url) {
          previewUrl = url.toString();
          this.logger.log(`📬 [LIVE EMAIL PREVIEW URL]: ${previewUrl}`);
          this.logger.log(`Recipient ${params.to} can view their invitation and accept it at: ${previewUrl}`);
        } else {
          this.logger.log(`Email successfully dispatched via SMTP to ${params.to} (Message ID: ${info.messageId})`);
        }
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

      return { success: true, previewUrl };
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

