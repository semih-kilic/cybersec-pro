import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { CountryFlags } from '../components/CountryFlags';

const GOOGLE_CLIENT_ID = '547951331800-kqkuc6aohfr7ptt26p38mnqfdvt7b6mu.apps.googleusercontent.com';
const GITHUB_CLIENT_ID = 'Ov23lizk4YnG8pDKXpWV';
const LINKEDIN_CLIENT_ID = '860csb8nohqn21';

/* ── Animated Grid Background ── */
function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let w = 0, h = 0;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Grid dots with subtle pulse
    const cols = Math.ceil(w / 40);
    const rows = Math.ceil(h / 40);
    const dots: { x: number; y: number; phase: number; speed: number }[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        dots.push({ x: i * 40 + 20, y: j * 40 + 20, phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.5 });
      }
    }

    // A few "highlight" nodes that glow green
    const highlights = Array.from({ length: 8 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 80 + Math.random() * 60,
    }));

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      t += 0.01;

      // Draw connecting lines between nearby highlights
      ctx.lineWidth = 0.5;
      for (let i = 0; i < highlights.length; i++) {
        for (let j = i + 1; j < highlights.length; j++) {
          const dx = highlights[i].x - highlights[j].x;
          const dy = highlights[i].y - highlights[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 300) {
            ctx.strokeStyle = `rgba(16,185,129,${0.04 * (1 - dist / 300)})`;
            ctx.beginPath();
            ctx.moveTo(highlights[i].x, highlights[i].y);
            ctx.lineTo(highlights[j].x, highlights[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw grid dots
      for (const d of dots) {
        const alpha = 0.06 + 0.04 * Math.sin(t * d.speed + d.phase);
        // Check proximity to highlights for glow
        let glow = 0;
        for (const hl of highlights) {
          const dx = d.x - hl.x;
          const dy = d.y - hl.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < hl.r) glow = Math.max(glow, 1 - dist / hl.r);
        }
        if (glow > 0) {
          ctx.fillStyle = `rgba(16,185,129,${0.15 + glow * 0.4})`;
          ctx.beginPath();
          ctx.arc(d.x, d.y, 1.5 + glow * 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.arc(d.x, d.y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Move highlights
      for (const hl of highlights) {
        hl.x += hl.vx;
        hl.y += hl.vy;
        if (hl.x < 0 || hl.x > w) hl.vx *= -1;
        if (hl.y < 0 || hl.y > h) hl.vy *= -1;
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}

/* ── Main Login Page ── */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleResendVerification = async () => {
    setResendStatus('sending');
    try {
      const res = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      });
      if (res.ok) setResendStatus('sent');
    } catch {
      setResendStatus('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setLoading(true);

    try {
      await login(email, password, requiresMfa ? mfaCode : undefined);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.requires_mfa) {
        setRequiresMfa(true);
        setMfaCode('');
        setError('');
      } else if (err.requires_verification) {
        setNeedsVerification(true);
        setVerificationEmail(err.email || email);
        setError(t('auth.verifyEmailBeforeLogin', 'Please verify your email address before logging in.'));
      } else {
        setError(err.message || t('auth.loginFailed', 'Login failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRequiresMfa(false);
    setMfaCode('');
    setError('');
  };

  const handleGoogleLogin = () => {
    const redirectUri = `${window.location.origin}/dashboard/auth/callback`;
    const scope = 'openid email profile';
    localStorage.setItem('oauth_provider', 'google');
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    window.location.href = googleAuthUrl;
  };

  const handleGitHubLogin = () => {
    const redirectUri = `${window.location.origin}/dashboard/auth/callback`;
    const scope = 'user:email';
    localStorage.setItem('oauth_provider', 'github');
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    window.location.href = githubAuthUrl;
  };

  const handleLinkedInLogin = () => {
    const redirectUri = `${window.location.origin}/dashboard/auth/callback`;
    const scope = 'openid profile email';
    localStorage.setItem('oauth_provider', 'linkedin');
    const linkedinAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    window.location.href = linkedinAuthUrl;
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
    .login-root{font-family:'Inter',system-ui,-apple-system,sans-serif;min-height:100vh;background:#0a0a0a;display:flex;position:relative;overflow:hidden}
    .login-root *{box-sizing:border-box;margin:0;padding:0}
    .login-left{flex:1;display:flex;flex-direction:column;justify-content:center;padding:60px 64px;position:relative;z-index:2}
    .login-right{width:480px;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px;position:relative;z-index:2;background:rgba(15,15,17,.85);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border-left:1px solid rgba(255,255,255,.05)}
    @media(max-width:960px){.login-root{flex-direction:column}.login-left{display:none}.login-right{width:100%;min-height:100vh;border-left:none}}

    /* ── Left Panel ── */
    .lp-brand{display:flex;align-items:center;gap:12px;font-weight:800;font-size:1rem;color:#f0f0f0;margin-bottom:56px}
    .lp-brand svg{flex-shrink:0}
    .lp-h{font-size:clamp(2rem,3.5vw,2.8rem);font-weight:800;letter-spacing:-.04em;line-height:1.08;color:#f0f0f0;margin-bottom:16px}
    .lp-h span{background:linear-gradient(135deg,#10b981,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    .lp-sub{font-size:.95rem;color:#6b7280;line-height:1.7;margin-bottom:48px;max-width:420px;font-weight:300}
    .lp-features{display:flex;flex-direction:column;gap:20px;margin-bottom:48px}
    .lp-feat{display:flex;gap:14px;align-items:flex-start}
    .lp-feat-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .lp-feat h4{font-size:.85rem;font-weight:600;color:#f0f0f0;margin-bottom:2px}
    .lp-feat p{font-size:.78rem;color:#4b5563;line-height:1.5}
    .lp-terminal{background:#0f0f11;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;font-size:.72rem;line-height:1.7;color:#6b7280;max-width:400px}
    .lp-terminal .grn{color:#10b981}
    .lp-terminal .cyn{color:#06b6d4}
    .lp-terminal .wht{color:#f0f0f0}

    /* ── Right Panel (Form) ── */
    .rf-wrap{width:100%;max-width:380px}
    .rf-logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:.9rem;color:#f0f0f0;margin-bottom:32px;justify-content:center}
    .rf-logo svg{flex-shrink:0}
    .rf-title{font-size:1.4rem;font-weight:700;color:#f0f0f0;margin-bottom:6px;text-align:center;letter-spacing:-.02em}
    .rf-subtitle{font-size:.82rem;color:#4b5563;text-align:center;margin-bottom:28px}
    .rf-social{display:flex;gap:10px;margin-bottom:24px}
    .rf-social button{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#9ca3af;font-size:.78rem;font-weight:500;cursor:pointer;font-family:inherit;transition:all .2s}
    .rf-social button:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.15);color:#f0f0f0}
    .rf-divider{display:flex;align-items:center;gap:12px;margin-bottom:24px}
    .rf-divider::before,.rf-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06)}
    .rf-divider span{font-size:.7rem;color:#4b5563;text-transform:uppercase;letter-spacing:.08em;font-weight:600}
    .rf-field{margin-bottom:18px}
    .rf-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
    .rf-label label{font-size:.78rem;font-weight:500;color:#9ca3af}
    .rf-label a{font-size:.72rem;color:#10b981;text-decoration:none;font-weight:500;transition:color .2s}
    .rf-label a:hover{color:#22d3a0}
    .rf-input-wrap{position:relative}
    .rf-input{width:100%;padding:11px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#f0f0f0;font-size:.85rem;font-family:inherit;outline:none;transition:all .2s}
    .rf-input::placeholder{color:#374151}
    .rf-input:focus{border-color:rgba(16,185,129,.4);box-shadow:0 0 0 3px rgba(16,185,129,.08)}
    .rf-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:#4b5563;cursor:pointer;padding:2px;transition:color .2s}
    .rf-eye:hover{color:#9ca3af}
    .rf-remember{display:flex;align-items:center;gap:8px;margin-bottom:24px}
    .rf-remember input[type=checkbox]{width:15px;height:15px;border-radius:4px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);cursor:pointer;accent-color:#10b981}
    .rf-remember label{font-size:.78rem;color:#6b7280;cursor:pointer}
    .rf-btn{width:100%;padding:12px;background:#10b981;color:#000;font-weight:700;font-size:.85rem;border:none;border-radius:10px;cursor:pointer;font-family:inherit;transition:all .2s;letter-spacing:-.01em}
    .rf-btn:hover:not(:disabled){background:#22d3a0;transform:translateY(-1px);box-shadow:0 4px 20px rgba(16,185,129,.25)}
    .rf-btn:disabled{opacity:.5;cursor:not-allowed}
    .rf-btn-outline{width:100%;padding:12px;background:transparent;color:#f0f0f0;font-weight:600;font-size:.85rem;border:1px solid rgba(255,255,255,.1);border-radius:10px;cursor:pointer;font-family:inherit;transition:all .2s}
    .rf-btn-outline:hover:not(:disabled){border-color:rgba(255,255,255,.2);background:rgba(255,255,255,.03)}
    .rf-footer{margin-top:24px;text-align:center;font-size:.78rem;color:#4b5563}
    .rf-footer a{color:#10b981;font-weight:500;text-decoration:none;transition:color .2s}
    .rf-footer a:hover{color:#22d3a0}
    .rf-back{display:flex;align-items:center;justify-content:center;gap:4px;margin-top:20px;font-size:.75rem;color:#374151;text-decoration:none;transition:color .2s}
    .rf-back:hover{color:#6b7280}
    .rf-error{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:10px;padding:12px 14px;margin-bottom:18px;color:#ef4444;font-size:.8rem;line-height:1.5}
    .rf-error button{color:#60a5fa;font-size:.72rem;font-weight:500;background:none;border:none;cursor:pointer;margin-top:8px;padding:0;font-family:inherit}
    .rf-error button:hover{color:#93bbfd}
    .rf-mfa-wrap{text-align:center;margin-bottom:20px}
    .rf-mfa-icon{width:48px;height:48px;border-radius:14px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.12);display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px}
    .rf-mfa-title{font-size:1.05rem;font-weight:700;color:#f0f0f0;margin-bottom:4px}
    .rf-mfa-sub{font-size:.78rem;color:#4b5563}
    .rf-mfa-input{width:100%;padding:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#f0f0f0;text-align:center;font-size:1.5rem;letter-spacing:.3em;font-family:'JetBrains Mono',monospace;outline:none;transition:all .2s}
    .rf-mfa-input:focus{border-color:rgba(16,185,129,.4);box-shadow:0 0 0 3px rgba(16,185,129,.08)}
    .rf-mfa-hint{font-size:.7rem;color:#374151;margin-top:6px}
    .rf-lang{display:flex;justify-content:center;margin-bottom:20px}
    @media(min-width:961px){.rf-logo{display:none}}
  `;

  return (
    <>
      <style>{css}</style>
      <div className="login-root">
        <GridBackground />

        {/* ── Left Panel: Branding ── */}
        <div className="login-left">
          <a href="/" className="lp-brand" style={{ textDecoration: 'none' }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><rect width="26" height="26" rx="6" fill="url(#lg1)"/><path d="M7.5 13l3 3 8-8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><defs><linearGradient id="lg1" x1="0" y1="0" x2="26" y2="26"><stop stopColor="#10b981"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs></svg>
            CyberSec Pro
          </a>

          <h1 className="lp-h">
            {t('login.heroTitleLine1', "Cyber threats don't sleep.")}<br/>
            <span>{t('login.heroTitleLine2', 'Neither should your defense.')}</span>
          </h1>
          <p className="lp-sub">
            {t('login.heroSubtitle', "Every 39 seconds, a cyber attack occurs somewhere in the world. Proactive security testing is no longer optional — it's essential.")}
          </p>

          <div className="lp-features">
            <div className="lp-feat">
              <div className="lp-feat-icon" style={{ background: 'rgba(239,68,68,.08)' }}>
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="1.5"><path d="M10 2l7 3.5v5c0 4-3 7.2-7 8.5-4-1.3-7-4.5-7-8.5v-5L10 2z"/><path d="M10 7v4M10 13h.01"/></svg>
              </div>
              <div>
                <h4>{t('login.whyItMatters', 'Why It Matters')}</h4>
                <p>{t('login.whyItMattersBody', 'Cybercrime damages are projected to reach $10.5 trillion annually by 2025 — more than the GDP of most countries')}</p>
              </div>
            </div>
            <div className="lp-feat">
              <div className="lp-feat-icon" style={{ background: 'rgba(245,158,11,.08)' }}>
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="#f59e0b" strokeWidth="1.5"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l3 3"/></svg>
              </div>
              <div>
                <h4>{t('login.timeIsCritical', 'Time Is Critical')}</h4>
                <p>{t('login.timeIsCriticalBody', 'Organizations take an average of 197 days to identify a breach and 69 days to contain it')}</p>
              </div>
            </div>
            <div className="lp-feat">
              <div className="lp-feat-icon" style={{ background: 'rgba(16,185,129,.08)' }}>
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="#10b981" strokeWidth="1.5"><path d="M10 2l7 3.5v5c0 4-3 7.2-7 8.5-4-1.3-7-4.5-7-8.5v-5L10 2z"/></svg>
              </div>
              <div>
                <h4>{t('login.stayAhead', 'Stay Ahead')}</h4>
                <p>{t('login.stayAheadBody', 'Continuous security testing helps you find vulnerabilities before attackers do')}</p>
              </div>
            </div>
          </div>

          {/* Country flags */}
          <CountryFlags />

          <div className="lp-terminal">
            <div><span className="grn">$</span> <span className="wht">nmap</span> <span className="cyn">-sC -sV -A</span> target.example.com</div>
            <div style={{ color: '#374151' }}>{t('login.terminalStarting', 'Starting Nmap 7.94SVN ...')}</div>
            <div><span className="cyn">PORT</span>     STATE  SERVICE</div>
            <div><span className="grn">22/tcp</span>   open   ssh</div>
            <div><span style={{ color: '#f59e0b' }}>443/tcp</span>  open   ssl <span style={{ color: '#ef4444' }}>VULNERABLE</span></div>
            <div style={{ color: '#374151', marginTop: '4px' }}>{t('login.terminalDone', 'Nmap done — 1 host scanned in 12.4s')}</div>
          </div>
        </div>

        {/* ── Right Panel: Login Form ── */}
        <div className="login-right">
          <div className="rf-wrap">
            {/* Mobile-only logo */}
            <a href="/" className="rf-logo" style={{ textDecoration: 'none' }}>
              <svg width="24" height="24" viewBox="0 0 26 26" fill="none"><rect width="26" height="26" rx="6" fill="url(#lg2)"/><path d="M7.5 13l3 3 8-8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><defs><linearGradient id="lg2" x1="0" y1="0" x2="26" y2="26"><stop stopColor="#10b981"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs></svg>
              CyberSec Pro
            </a>

            <div className="rf-lang">
              <LanguageSwitcher variant="compact" />
            </div>

            <h2 className="rf-title">
              {requiresMfa ? '' : t('auth.signInTitle', 'Sign in to your account')}
            </h2>
            {!requiresMfa && <p className="rf-subtitle">{t('auth.signInSubtitle', 'Access your security dashboard')}</p>}

            {/* Error */}
            {error && (
              <div className="rf-error">
                {error}
                {needsVerification && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(239,68,68,.1)' }}>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendStatus === 'sending' || resendStatus === 'sent'}
                    >
                      {resendStatus === 'sending' ? t('auth.sending', 'Sending...') : resendStatus === 'sent' ? t('auth.verificationSent', '✅ Verification email sent!') : t('auth.resendVerification', '📧 Resend verification email')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {requiresMfa ? (
              /* ── MFA View ── */
              <form onSubmit={handleSubmit}>
                <div className="rf-mfa-wrap">
                  <div className="rf-mfa-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1.5"/></svg>
                  </div>
                  <div className="rf-mfa-title">{t('auth.mfaTitle', 'Two-Factor Authentication')}</div>
                  <p className="rf-mfa-sub">{t('auth.mfaDescription', 'Enter the 6-digit code from your authenticator app')}</p>
                </div>

                <div className="rf-field">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={8}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    className="rf-mfa-input"
                    placeholder="000000"
                  />
                  <p className="rf-mfa-hint">{t('auth.mfaBackupHint', 'You can also use a backup code')}</p>
                </div>

                <button type="submit" disabled={loading || mfaCode.length < 6} className="rf-btn" style={{ marginBottom: '10px' }}>
                  {loading ? t('auth.verifying', 'Verifying...') : t('auth.verify', 'Verify')}
                </button>

                <button type="button" onClick={handleBackToLogin} className="rf-btn-outline">
                  ← {t('auth.backToLogin', 'Back to login')}
                </button>
              </form>
            ) : (
              /* ── Normal Login View ── */
              <>
                {/* Social buttons */}
                <div className="rf-social">
                  <button type="button" onClick={handleGoogleLogin}>
                    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Google
                  </button>
                  <button type="button" onClick={handleGitHubLogin}>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/></svg>
                    GitHub
                  </button>
                  <button type="button" onClick={handleLinkedInLogin} className="!bg-[#0077b5] hover:!bg-[#006399] border-none">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.181V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    LinkedIn
                  </button>
                </div>

                <div className="rf-divider"><span>{t('auth.orSignInWithEmail', 'or sign in with email')}</span></div>

                <form onSubmit={handleSubmit}>
                  <div className="rf-field">
                    <div className="rf-label">
                      <label htmlFor="email">{t('auth.email', 'Email address')}</label>
                    </div>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rf-input"
                      placeholder={t('auth.emailPlaceholder', 'you@company.com')}
                      autoComplete="email"
                    />
                  </div>

                  <div className="rf-field">
                    <div className="rf-label">
                      <label htmlFor="password">{t('auth.password', 'Password')}</label>
                      <Link to="/forgot-password">{t('auth.forgotPassword', 'Forgot password?')}</Link>
                    </div>
                    <div className="rf-input-wrap">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="rf-input"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        style={{ paddingRight: '40px' }}
                      />
                      <button type="button" className="rf-eye" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} aria-label="Toggle password visibility">
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="rf-remember">
                    <input type="checkbox" id="remember" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                    <label htmlFor="remember">{t('auth.rememberMe', 'Remember me')}</label>
                  </div>

                  <button type="submit" disabled={loading} className="rf-btn">
                    {loading ? t('auth.signingIn', 'Signing in...') : t('auth.signIn', 'Sign in')}
                  </button>
                </form>

                <div className="rf-footer">
                  {t('auth.noAccount', "Don't have an account?")}{' '}
                  <Link to="/register">{t('auth.startFreeTrial', 'Start free trial')}</Link>
                </div>
              </>
            )}

            <Link to="/" className="rf-back">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3L5 8l5 5"/></svg>
              {t('auth.backToHome', 'Back to home')}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
