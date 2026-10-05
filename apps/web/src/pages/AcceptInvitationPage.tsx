import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Mail,
  KeyRound,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Building2,
  Briefcase,
} from 'lucide-react';

interface InvitationDetails {
  fullName: string;
  email: string;
  employeeId?: string;
  roleName: string;
  projectName?: string | null;
  isLead?: boolean;
}

export const AcceptInvitationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState<'VALIDATING' | 'WELCOME' | 'ENTER_OTP' | 'SUCCESS' | 'ERROR'>('VALIDATING');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // OTP state
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [isRequestingOtp, setIsRequestingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState<number>(600); // 10 minutes
  const [cooldown, setCooldown] = useState<number>(0);
  const [otpError, setOtpError] = useState<string>('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setStep('ERROR');
      setErrorMessage('Missing invitation token in URL.');
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`/api/v1/auth/invitation/validate?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const err = await res.json();
          setStep('ERROR');
          setErrorMessage(err.message || 'Invitation token is invalid or expired.');
          return;
        }

        const data = await res.json();
        setInvitation(data.user);
        setStep('WELCOME');
      } catch (err: any) {
        setStep('ERROR');
        setErrorMessage(err.message || 'Network error validating invitation token.');
      }
    };

    validateToken();
  }, [token]);

  // Countdown timers for cooldown and OTP expiration
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    if (step === 'ENTER_OTP' && otpExpiresIn > 0) {
      const timer = setTimeout(() => setOtpExpiresIn((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, otpExpiresIn]);

  // Step 1: Request OTP
  const handleRequestOtp = async () => {
    setIsRequestingOtp(true);
    setOtpError('');

    try {
      const res = await fetch('/api/v1/auth/invitation/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.message || 'Failed to dispatch verification code.');
        return;
      }

      setStep('ENTER_OTP');
      setCooldown(60);
      setOtpExpiresIn(600);
      if (data.devOtp) {
        setDevOtpHint(data.devOtp);
      }
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setOtpError(err.message || 'Network error requesting OTP.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // Step 2: Handle OTP box inputs
  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);

    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  // Step 3: Verify OTP
  const handleVerifyOtp = async () => {
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) {
      setOtpError('Please enter all 6 digits of the code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');

    try {
      const res = await fetch('/api/v1/auth/invitation/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, otp: fullOtp }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.message || 'Invalid verification code.');
        return;
      }

      setStep('SUCCESS');
      await refreshUser();

      setTimeout(() => {
        navigate(data.redirectTo || '/dashboard', { replace: true });
      }, 1500);
    } catch (err: any) {
      setOtpError(err.message || 'Network error verifying code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow Effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">WorkDesk 2.0</h1>
          <p className="text-xs text-slate-400 font-mono">Work Management & Accountability</p>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8">
        {step === 'VALIDATING' && (
          <div className="py-12 flex flex-col items-center text-center">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
            <h2 className="text-lg font-semibold text-white">Validating Invitation</h2>
            <p className="text-sm text-slate-400 mt-1">Please wait while we verify your invitation token...</p>
          </div>
        )}

        {step === 'ERROR' && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Invitation Unavailable</h2>
            <p className="text-sm text-slate-400 mt-2">{errorMessage}</p>
            <div className="mt-6 pt-6 border-t border-slate-800">
              <p className="text-xs text-slate-500">
                Please contact your Manager to request a new invitation link.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="mt-4 text-sm text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
              >
                Return to Sign In <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'WELCOME' && invitation && (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Welcome, {invitation.fullName}</h2>
              <p className="text-sm text-slate-400 mt-1">
                You have been invited to join the WorkDesk platform.
              </p>
            </div>

            {/* Assignment Summary Box */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Account Email:</span>
                <span className="font-mono text-slate-200">{invitation.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Assigned Role:</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Briefcase className="w-3 h-3" />
                  {invitation.roleName}
                  {invitation.isLead && ' (Product Lead)'}
                </span>
              </div>
              {invitation.projectName && (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Assigned Product:</span>
                  <span className="inline-flex items-center gap-1 font-medium text-indigo-300">
                    <Building2 className="w-3 h-3 text-indigo-400" />
                    {invitation.projectName}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 text-center mb-6 leading-relaxed">
              To activate your access and verify identity, a secure 6-digit confirmation code will be dispatched to your registered email.
            </p>

            {otpError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <button
              onClick={handleRequestOtp}
              disabled={isRequestingOtp}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isRequestingOtp ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Dispatching Code...
                </>
              ) : (
                <>
                  Confirm & Request Verification Code
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {step === 'ENTER_OTP' && invitation && (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Enter 6-Digit Code</h2>
              <p className="text-xs text-slate-400 mt-1">
                Sent to <span className="font-mono text-slate-300">{invitation.email}</span>
              </p>
            </div>

            {/* Development OTP Notice (Visible when local SMTP unconfigured) */}
            {devOtpHint && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-center justify-between">
                <span>Local Verification Code:</span>
                <span className="font-mono font-bold tracking-widest text-amber-200 bg-amber-950/60 px-2 py-0.5 rounded">
                  {devOtpHint}
                </span>
              </div>
            )}

            {/* 6 Digit Input Boxes */}
            <div className="flex justify-center gap-2.5 mb-6" onPaste={handlePaste}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-12 h-14 text-center text-xl font-bold font-mono bg-slate-950/80 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-inner"
                />
              ))}
            </div>

            {/* Timer and Resend Controls */}
            <div className="flex items-center justify-between text-xs text-slate-400 mb-6 px-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Expires in {Math.floor(otpExpiresIn / 60)}:{(otpExpiresIn % 60).toString().padStart(2, '0')}</span>
              </div>
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={cooldown > 0 || isRequestingOtp}
                className="text-blue-400 hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
              </button>
            </div>

            {otpError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <button
              onClick={handleVerifyOtp}
              disabled={isVerifyingOtp || otp.join('').length !== 6}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifyingOtp ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verifying Identity...
                </>
              ) : (
                <>
                  Verify Code & Enter Workbench
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {step === 'SUCCESS' && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Identity Verified!</h2>
            <p className="text-sm text-slate-300 mt-2">
              Your account is active. Preparing your personalized workbench...
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 text-xs text-slate-500 font-mono">
        Secured by WorkDesk Governance Engine &bull; Zero Unauthorized Access
      </div>
    </div>
  );
};
