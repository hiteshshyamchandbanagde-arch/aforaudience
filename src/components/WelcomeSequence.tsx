'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/translate';
import { useOtpVerification } from '@/lib/useOtpVerification';
import { subscribeAndSave } from '@/lib/push-subscribe';
import { isOnboardingSequenceDue } from '@/lib/onboarding';
import { BellIcon } from '@/components/icons/VenueIcons';

/**
 * GEN-2609-042 - one-time, full-screen welcome sequence shown after
 * signup: Welcome -> Verify phone -> Enable notifications -> next-step
 * card. Replaces phone verification's old spot in NudgeStack's
 * persistent-banner treatment (PhoneVerifyNudge itself stays - it's the
 * fallback for pre-existing users who never go through this sequence,
 * see docs/onboarding-guidelines.md).
 *
 * Gated on session.user.onboardedAt === null (see lib/onboarding.ts,
 * shared with NudgeStack's own suppression check). Never a hard block -
 * every step that has a real action to decline (verify, enable) has a
 * visible skip path, per the browse-first/never-block principle
 * (docs/design.md §2) - only the sequence's *entry point* (mounting at
 * all) isn't optional, same as any other one-time first-run screen.
 *
 * Reuses .afa-backdrop-mount/.afa-sheet-mount (docs/motion-guidelines.md)
 * for the takeover's entrance - same structure MobileEventFilterSheet.tsx
 * uses, just full-viewport instead of a bottom sheet. Mounts once per
 * sequence (not per internal step change) so the animation only plays
 * on first appearance, not on every Screen 1->2->3->4 transition.
 */

type Step = 1 | 2 | 3 | 4;

export default function WelcomeSequence() {
  const { data: session, status, update } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { t: tr } = useLocale();
  const otp = useOtpVerification();

  const [step, setStep] = useState<Step>(1);
  const [otpCode, setOtpCode] = useState('');
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const user = session?.user as
    | { phone?: string | null; isVerified?: boolean; onboardedAt?: string | null; intendedRole?: string | null }
    | undefined;

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setPushSupported(ok);
    if (ok) setPushPermission(Notification.permission);
  }, []);

  // Screen 2 entry: only sends a real code when there's an actual
  // unverified phone to verify - registration's own OTP stage already
  // verifies most users before they ever reach here (see
  // docs/onboarding-guidelines.md), and Google sign-up never collects a
  // phone at all, so those two cases get a brief acknowledgment instead
  // of a form with nothing to submit (handled in the render below).
  // SIGNUP_VERIFY's 5-minute TTL (src/lib/otp.ts) means any code sent
  // back at registration time is long expired by a delayed first login,
  // so a fresh send here is always issued - never assumed still good.
  useEffect(() => {
    if (step !== 2 || !user) return;
    if (!user.isVerified && user.phone) {
      otp.sendCode(user.phone, tr.loginPage.couldNotSendCodeError, tr.authErrors as Record<string, string>);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, user?.isVerified, user?.phone]);

  // Screen 3 entry: skip if push isn't supported on this browser, or
  // permission is already decided one way or the other - same gating
  // NotificationOptIn.tsx uses, nothing left to ask.
  useEffect(() => {
    if (step !== 3) return;
    if (!pushSupported || pushPermission !== 'default') setStep(4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pushSupported, pushPermission]);

  if (status !== 'authenticated' || !user) return null;
  if (!isOnboardingSequenceDue(user.onboardedAt, pathname)) return null;

  const completeOnboarding = async () => {
    setFinishing(true);
    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingComplete: true }),
      });
      await update();
    } finally {
      setFinishing(false);
    }
  };

  const handleVerify = async () => {
    if (!user.phone) return;
    const ok = await otp.verifyCode(user.phone, (session?.user as any).id, otpCode, tr.registerPage.invalidCodeFallback);
    if (ok) setStep(3);
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm === 'granted') await subscribeAndSave();
    } catch {
      // Same "don't fail the flow over it" posture as NotificationOptIn -
      // a rejected/failed subscribe just means this step didn't do
      // anything, not an error state to surface.
    } finally {
      setPushBusy(false);
      setStep(4);
    }
  };

  const finalCta =
    user.intendedRole === 'artist' || user.intendedRole === 'organiser' || user.intendedRole === 'venue'
      ? {
          href: `/profile?role=${user.intendedRole}`,
          label: tr.welcomeSequence.step4RoleCtaTemplate.replace(
            '{role}',
            user.intendedRole === 'artist' ? tr.roles.ARTIST : user.intendedRole === 'organiser' ? tr.roles.ORGANISER : tr.roles.VENUE_OWNER
          ),
        }
      : { href: '/events', label: tr.welcomeSequence.step4FallbackCta };

  return (
    <div
      className="afa-backdrop-mount"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'var(--afa-surface-page)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: 24,
      }}
    >
      <div
        className="afa-sheet-mount"
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--afa-surface-raised)',
          borderRadius: 16,
          border: '1px solid var(--afa-tint-08)',
          padding: 40,
          textAlign: 'center',
        }}
      >
        {step === 1 && (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 12 }}>
              {tr.welcomeSequence.step1Heading}
            </h1>
            <p style={{ fontSize: 15, color: 'var(--afa-text-secondary)', lineHeight: 1.5, marginBottom: 28 }}>
              {tr.welcomeSequence.step1Subtitle}
            </p>
            <Button variant="primary" onClick={() => setStep(2)}>
              {tr.welcomeSequence.getStartedButton}
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 8 }}>
              {tr.welcomeSequence.step2Heading}
            </h1>
            {user.isVerified ? (
              <>
                <p style={{ fontSize: 14, color: 'var(--afa-text-secondary)', marginBottom: 24 }}>
                  {tr.verifyPhonePage.alreadyVerifiedMessage}
                </p>
                <Button variant="primary" onClick={() => setStep(3)}>
                  {tr.verifyPhonePage.continueArrow}
                </Button>
              </>
            ) : !user.phone ? (
              <>
                <p style={{ fontSize: 14, color: 'var(--afa-text-secondary)', marginBottom: 24 }}>
                  {tr.welcomeSequence.noPhoneOnFileMessage}
                </p>
                <Button variant="primary" onClick={() => setStep(3)}>
                  {tr.verifyPhonePage.continueArrow}
                </Button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, color: 'var(--afa-text-secondary)', marginBottom: 24 }}>
                  {tr.welcomeSequence.step2Intro}
                </p>
                {otp.error && <p style={{ fontSize: 13, color: 'var(--afa-error)', marginBottom: 16 }}>{otp.error}</p>}
                {otp.devOtp && (
                  <div style={{ background: 'rgba(201,151,58,0.08)', border: '1px solid var(--afa-amber)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--afa-text-primary)' }}>
                    QA Mode — dev OTP: <strong>{otp.devOtp}</strong>
                  </div>
                )}
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                  placeholder={tr.verifyPhonePage.sixDigitCodePlaceholder}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--afa-border-resting)',
                    fontSize: 18,
                    letterSpacing: '0.3em',
                    textAlign: 'center',
                    color: 'var(--afa-text-primary)',
                    background: 'var(--afa-surface-page)',
                    marginBottom: 16,
                  }}
                />
                <Button variant="primary" onClick={handleVerify} disabled={otp.submitting || otpCode.length !== 6}>
                  {otp.submitting ? tr.loginPage.verifyingEllipsis : tr.registerPage.verifyButton}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => user.phone && otp.sendCode(user.phone, tr.loginPage.couldNotSendCodeError, tr.authErrors as Record<string, string>)}
                  disabled={otp.submitting}
                >
                  {tr.loginPage.resendCodeButton}
                </Button>
                <Button variant="secondary" onClick={() => setStep(3)}>
                  {tr.welcomeSequence.skipButton}
                </Button>
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <BellIcon style={{ width: 32, height: 32, color: 'var(--afa-text-primary)' }} />
            </div>
            <p style={{ fontSize: 15, color: 'var(--afa-text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
              {tr.notificationOptIn.message}
            </p>
            <Button variant="primary" onClick={handleEnablePush} disabled={pushBusy}>
              {pushBusy ? tr.notificationOptIn.enabling : tr.notificationOptIn.enable}
            </Button>
            <Button variant="secondary" onClick={() => setStep(4)}>
              {tr.welcomeSequence.skipButton}
            </Button>
          </>
        )}

        {step === 4 && (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--afa-text-primary)', marginBottom: 24 }}>
              {tr.welcomeSequence.step4Heading}
            </h1>
            <Button
              variant="primary"
              disabled={finishing}
              onClick={async () => {
                await completeOnboarding();
                router.push(finalCta.href);
              }}
            >
              {finalCta.label}
            </Button>
            <Button variant="secondary" onClick={completeOnboarding} disabled={finishing}>
              {tr.welcomeSequence.skipButton}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
