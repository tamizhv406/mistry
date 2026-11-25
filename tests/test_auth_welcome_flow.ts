/**
 * Welcome screen and sign-up (task sheet, Task 3): the app never opens without an account,
 * Phone OTP and email sign-up / log-in steps (with a stand-in for Supabase Auth), session kept
 * across a reload, Logout back to Welcome, and every message in English and Tamil.
 */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';

// Browser storage for the session helpers (Node has none by default).
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  };
}
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true, writable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: memoryStorage(), configurable: true, writable: true });

const { getCurrentUser, setCurrentUser, getLocalWorkspaceUser, restoreSession, logoutUser } = await import('../src/services/auth');
const { InactiveAccountError } = await import('../src/services/cloudAuth');
const flow = await import('../src/services/authFlow');
const { AUTH_DICTIONARY } = await import('../src/services/authText');
import type { User } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

const account = (over: Partial<User> = {}): User => ({
  id: 'acc-1', username: 'ravi', fullName: 'Ravi Kumar', mobile: '+919876543210', email: 'ravi@example.test', passwordHash: '',
  role: 'MISTRY', isActive: true, createdAt: '2026-01-01T00:00:00.000Z', ...over,
});
const authUser = (meta: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  ({ id: 'acc-1', phone: '919876543210', email: 'ravi@example.test', user_metadata: meta, app_metadata: {}, aud: 'authenticated', created_at: '2026-01-01', ...extra }) as never;

/** A stand-in for supabase.auth that records calls and answers with scripted results. */
function fakeAuth(script: Partial<Record<string, (args: any) => unknown>> = {}) {
  const calls: Array<{ fn: string; args: any }> = [];
  let session: { user: unknown } | null = null;
  const run = (fn: string, args: any, fallback: unknown) => {
    calls.push({ fn, args });
    const out = script[fn] ? script[fn]!(args) : fallback;
    return Promise.resolve(out);
  };
  const auth = {
    signInWithOtp: (a: any) => run('signInWithOtp', a, { data: {}, error: null }),
    verifyOtp: (a: any) => run('verifyOtp', a, { data: { user: authUser(), session: { access_token: 'x' } }, error: null }),
    signUp: (a: any) => run('signUp', a, { data: { user: authUser({ full_name: a.options?.data?.full_name }, { identities: [{}] }), session: { access_token: 'x' } }, error: null }),
    signInWithPassword: (a: any) => run('signInWithPassword', a, { data: { user: authUser({ full_name: 'Ravi Kumar' }), session: { access_token: 'x' } }, error: null }),
    updateUser: (a: any) => run('updateUser', a, { data: { user: authUser(a.data) }, error: null }),
    signOut: (a: any) => { session = null; return run('signOut', a, { error: null }); },
    getSession: (a: any) => run('getSession', a, { data: { session }, error: null }),
    resend: (a: any) => run('resend', a, { data: {}, error: null }),
  };
  return { auth: auth as never as flow.AuthClient, calls, setSession: (s: typeof session) => { session = s; } };
}
const deps = (f: ReturnType<typeof fakeAuth>, over: Partial<flow.FlowDeps> = {}): flow.FlowDeps => ({
  auth: f.auth, configured: true, resolveUser: async () => account(), isOnline: () => true, ...over,
});

console.log('\n--- 1. No way into the app without an account ---');
const g0 = flow.initialAuthGateState;
check('Start-up begins on the splash (checking)', g0.status === 'checking' && g0.user === null);
const out = flow.authGateReducer(g0, { type: 'RESTORED', user: null });
check('No saved sign-in → Welcome (signed-out), no user', out.status === 'signed-out' && out.user === null);
check('The old on-device "local builder" is not a sign-in', flow.authGateReducer(g0, { type: 'RESTORED', user: getLocalWorkspaceUser() }).status === 'signed-out');
check('Signing in as the local builder is ignored', flow.authGateReducer(out, { type: 'SIGNED_IN', user: getLocalWorkspaceUser() }).status === 'signed-out');
const inGate = flow.authGateReducer(out, { type: 'SIGNED_IN', user: account() });
check('A real sign-in opens the workspace and offers to move device projects', inGate.status === 'signed-in' && inGate.user?.id === 'acc-1' && inGate.justSignedIn);
const restored = flow.authGateReducer(g0, { type: 'RESTORED', user: account() });
check('A restored session opens straight to the workspace (no project move prompt)', restored.status === 'signed-in' && !restored.justSignedIn);
check('Signing out returns to Welcome', flow.authGateReducer(inGate, { type: 'SIGNED_OUT' }).status === 'signed-out');
check('A late start-up result cannot override a sign-in made meanwhile', flow.authGateReducer(inGate, { type: 'RESTORED', user: null }).status === 'signed-in');

const app = read('src/App.tsx');
check('App shows the splash while checking, LoginView when signed out, and the workspace only when signed in',
  /if \(gate\.status === 'checking'\) return <SplashScreen \/>;/.test(app) &&
  /if \(gate\.status !== 'signed-in' \|\| !gate\.user\) \{\s*return \(\s*<LoginView/.test(app) &&
  (app.match(/<Workspace\b/g) || []).length === 1 && app.indexOf('<Workspace') > app.indexOf("gate.status !== 'signed-in'"));
check('No automatic local / demo account anywhere in App', !/getLocalWorkspaceUser|isAuthModalOpen/.test(app));
const authSrc = read('src/services/auth.ts');
check('Start-up never signs in the local builder', !/setCurrentUser\(localUser\)|setCurrentUser\(getLocalWorkspaceUser\(\)\)/.test(authSrc));

console.log('\n--- 2. Start-up with and without a saved session ---');
localStorage.clear();
check('Nothing saved, cloud not set up → Welcome', (await restoreSession({ configured: false })) === null && getCurrentUser() === null);
setCurrentUser(getLocalWorkspaceUser());
check('An old local-builder session is forgotten → Welcome', (await restoreSession({ configured: false })) === null && getCurrentUser() === null);

const f = fakeAuth();
f.setSession({ user: authUser({ full_name: 'Ravi Kumar' }) });
const resolveUser = async () => account();
const first = await restoreSession({ configured: true, auth: f.auth, resolveUser, online: true });
check('Saved Supabase session → straight to the app as that account', first?.id === 'acc-1' && getCurrentUser()?.id === 'acc-1');
// A reload: same saved session in the browser, a fresh start-up.
const afterReload = await restoreSession({ configured: true, auth: f.auth, resolveUser, online: true });
check('After a reload (F5) the account is still signed in', afterReload?.id === 'acc-1' && afterReload.fullName === 'Ravi Kumar');
check('The cached session never holds a password', !('passwordHash' in (JSON.parse(localStorage.getItem('building_mistry_auth_user') || '{}'))));

const offlineAuth = fakeAuth({ getSession: () => ({ data: { session: null }, error: { message: 'Failed to fetch' } }) });
const offline = await restoreSession({ configured: true, auth: offlineAuth.auth, resolveUser, online: false });
check('Offline, an account that signed in before stays signed in (limited rights)', offline?.id === 'acc-1' && offline.offlineLimited === true && offline.role === 'MISTRY');

const slow = fakeAuth();
slow.setSession({ user: authUser() });
const viaCache = await restoreSession({
  configured: true, auth: slow.auth, online: true, timeoutMs: 30,
  resolveUser: () => new Promise<User>(() => {}),
  resolveOffline: async id => ({ ...account({ id }), offlineLimited: true, role: 'MISTRY', permissions: {} }),
});
check('A slow cloud profile does not hang the splash: opens with the saved profile', viaCache?.offlineLimited === true);

const disabled = fakeAuth();
disabled.setSession({ user: authUser() });
let threw = false;
try {
  await restoreSession({ configured: true, auth: disabled.auth, online: true, resolveUser: async () => { throw new InactiveAccountError('This account is disabled.'); } });
} catch (e) {
  threw = e instanceof InactiveAccountError;
}
check('A disabled account is stopped at start-up and its session cleared', threw && getCurrentUser() === null);

console.log('\n--- 3. Logout ---');
setCurrentUser(account());
const lo = fakeAuth();
lo.setSession({ user: authUser() });
await logoutUser(lo.auth);
check('Logout signs out of Supabase on this device and clears the saved user',
  lo.calls.some(c => c.fn === 'signOut' && c.args?.scope === 'local') && getCurrentUser() === null);
check('After logout, the next start-up shows Welcome', (await restoreSession({ configured: true, auth: lo.auth, resolveUser, online: true })) === null);
const offlineOut = { signOut: () => Promise.reject(new Error('Failed to fetch')) };
setCurrentUser(account());
await logoutUser(offlineOut as never);
check('Logout still clears the device when the network is down', getCurrentUser() === null);
check('App: sign out → logoutUser → Welcome with "You have signed out"',
  /const signOut = async \(\) => \{\s*await logoutUser\(\);\s*setNotice\(\{ kind: 'success', key: 'auth_signed_out' \}\);\s*dispatch\(\{ type: 'SIGNED_OUT' \}\);/.test(app));
check('Logout is in Settings, the phone More menu and the desktop sidebar',
  read('src/views/SettingsView.tsx').includes('id="settings-sign-out"') && /label: 'Sign out'/.test(read('src/components/mobile/MobileChrome.tsx')) &&
  read('src/components/AppSidebar.tsx').includes('onClick={onLogout}') && app.includes('onSignOut={handleLogout}'));
check('Sessions persist in the browser when Supabase is set up (persistSession)', /persistSession: configured/.test(read('lib/supabaseClient.ts')));

console.log('\n--- 4. Phone OTP ---');
check('+91 is the default and common ways of typing a number are accepted',
  flow.normalizePhone('98765 43210') === '+919876543210' && flow.normalizePhone('098765-43210') === '+919876543210' &&
  flow.normalizePhone('+91 98765 43210') === '+919876543210' && flow.normalizePhone('919876543210') === '+919876543210');
check('Wrong numbers are refused', flow.normalizePhone('12345') === null && flow.normalizePhone('5876543210') === null && flow.normalizePhone('98765abc10') === null);
check('Other country codes work', flow.normalizePhone('4155550123', '+1') === '+14155550123' && flow.normalizePhone('+447700900123') === '+447700900123');

let p = fakeAuth();
let r = await flow.requestPhoneOtp(deps(p), '12345', 'signup');
check('Invalid number → message, no SMS sent', !r.ok && r.errorKey === 'auth_err_phone' && p.calls.length === 0);
r = await flow.requestPhoneOtp(deps(p, { configured: false }), '9876543210', 'signup');
check('Sign-in not set up → clear message', !r.ok && r.errorKey === 'auth_err_not_configured');
r = await flow.requestPhoneOtp(deps(p, { isOnline: () => false }), '9876543210', 'signup');
check('Offline → clear message, no request', !r.ok && r.errorKey === 'auth_err_offline' && p.calls.length === 0);
r = await flow.requestPhoneOtp(deps(p), '98765 43210', 'signup');
check('Create Account: SMS sent to +91 number and may create the account',
  r.ok && r.phone === '+919876543210' && p.calls[0].args.phone === '+919876543210' && p.calls[0].args.options.shouldCreateUser === true);
p = fakeAuth();
await flow.requestPhoneOtp(deps(p), '9876543210', 'login');
check('Log In: never creates an account', p.calls[0].args.options.shouldCreateUser === false);
p = fakeAuth({ signInWithOtp: () => ({ data: {}, error: { message: 'Signups not allowed for otp', status: 422 } }) });
r = await flow.requestPhoneOtp(deps(p), '9876543210', 'login');
check('Log In with an unknown number → "create an account first"', !r.ok && r.errorKey === 'auth_err_no_account');
p = fakeAuth({ signInWithOtp: () => ({ data: {}, error: { message: 'For security purposes, you can only request this after 42 seconds.', status: 429 } }) });
r = await flow.requestPhoneOtp(deps(p), '9876543210', 'signup');
check('Too many SMS requests → rate-limit message', !r.ok && r.errorKey === 'auth_err_rate_limit');
p = fakeAuth({ signInWithOtp: () => ({ data: {}, error: { message: 'Unsupported phone provider' } }) });
r = await flow.requestPhoneOtp(deps(p), '9876543210', 'signup');
check('SMS not switched on in Supabase → "use email for now"', !r.ok && r.errorKey === 'auth_err_phone_unavailable');
p = fakeAuth({ signInWithOtp: () => { throw new TypeError('Failed to fetch'); } });
r = await flow.requestPhoneOtp(deps(p), '9876543210', 'signup');
check('Network failure → "check your internet"', !r.ok && r.errorKey === 'auth_err_network');

p = fakeAuth();
let v = await flow.verifyPhoneCode(deps(p), '+919876543210', '12a4');
check('Code must be 6 digits (no request otherwise)', !v.ok && v.errorKey === 'auth_err_otp_format' && p.calls.length === 0);
p = fakeAuth({ verifyOtp: () => ({ data: { user: null, session: null }, error: { message: 'Token has expired or is invalid', status: 403 } }) });
v = await flow.verifyPhoneCode(deps(p), '+919876543210', '123456');
check('Wrong / expired code → clear message', !v.ok && v.errorKey === 'auth_err_wrong_otp');
p = fakeAuth();
v = await flow.verifyPhoneCode(deps(p), '+919876543210', '123456');
check('New phone account (no name yet) → asks for the name next', v.ok && v.needsName === true && p.calls[0].args.type === 'sms' && p.calls[0].args.token === '123456');
p = fakeAuth({ verifyOtp: () => ({ data: { user: authUser({ full_name: 'Ravi Kumar' }), session: { access_token: 'x' } }, error: null }) });
v = await flow.verifyPhoneCode(deps(p), '+919876543210', '123456');
check('Returning phone account → straight in', v.ok && v.needsName === false);
p = fakeAuth();
v = await flow.verifyPhoneCode(deps(p, { resolveUser: async () => { throw new InactiveAccountError('This account is disabled. Contact the Super Admin.'); } }), '+919876543210', '123456');
check('Profile cannot be loaded → signed out again with a message (no half sign-in)', !v.ok && v.errorKey === 'auth_err_account_disabled' && p.calls.some(c => c.fn === 'signOut'));

p = fakeAuth();
let n = await flow.saveProfileName(deps(p), account({ fullName: '+919876543210', username: '+919876543210' }), ' R ');
check('Name step: at least 2 letters', !n.ok && n.errorKey === 'auth_err_name' && p.calls.length === 0);
n = await flow.saveProfileName(deps(p), account({ fullName: '+919876543210', username: '+919876543210' }), '  Ravi Kumar ');
check('Name step saves the name to the account and the profile', n.ok && n.user.fullName === 'Ravi Kumar' && n.user.username === 'Ravi Kumar' && p.calls[0].args.data.full_name === 'Ravi Kumar');

let s = flow.phoneOtpReducer(flow.initialPhoneOtpState, { type: 'START' });
check('Sending: busy, buttons disabled', s.busy && s.step === 'phone');
check('A second tap while sending changes nothing (no duplicate SMS)', flow.phoneOtpReducer(s, { type: 'START' }) === s);
s = flow.phoneOtpReducer(s, { type: 'FAIL', errorKey: 'auth_err_rate_limit' });
check('Failure keeps the number screen with the message', s.step === 'phone' && !s.busy && s.errorKey === 'auth_err_rate_limit');
s = flow.phoneOtpReducer(flow.phoneOtpReducer(s, { type: 'START' }), { type: 'CODE_SENT', phone: '+919876543210', now: 1000 });
check('Code sent → code screen, resend after 30 s', s.step === 'code' && s.phone === '+919876543210' && s.resendAt === 31000 && s.infoKey === 'auth_otp_sent');
check('"Change number" goes back to the number screen', flow.phoneOtpReducer(s, { type: 'EDIT_PHONE' }).step === 'phone');
const named = flow.phoneOtpReducer(flow.phoneOtpReducer(s, { type: 'START' }), { type: 'VERIFIED', user: account(), needsName: true });
check('Verified new account → name screen', named.step === 'name' && named.pendingUser?.id === 'acc-1');

console.log('\n--- 5. Email sign-up and log-in ---');
const good = { fullName: 'Ravi Kumar', email: 'Ravi@Example.test', password: 'site2026build', confirmPassword: 'site2026build' };
check('Form checks: name, email, length, letters+numbers, common, match',
  flow.validateEmailSignUp({ ...good, fullName: 'R' }) === 'auth_err_name' &&
  flow.validateEmailSignUp({ ...good, email: 'ravi@' }) === 'auth_err_email' &&
  flow.validateEmailSignUp({ ...good, password: 'a1', confirmPassword: 'a1' }) === 'auth_err_password_short' &&
  flow.validateEmailSignUp({ ...good, password: 'abcdefgh', confirmPassword: 'abcdefgh' }) === 'auth_err_password_mix' &&
  flow.validateEmailSignUp({ ...good, password: 'password123', confirmPassword: 'password123' }) === 'auth_err_password_common' &&
  flow.validateEmailSignUp({ ...good, confirmPassword: 'site2026builx' }) === 'auth_err_password_match' &&
  flow.validateEmailSignUp(good) === null);
let e = fakeAuth();
let su = await flow.signUpWithEmail(deps(e), { ...good, password: 'short1', confirmPassword: 'short1' });
check('Invalid form → no request', !su.ok && e.calls.length === 0);
su = await flow.signUpWithEmail(deps(e), good, 'https://app.example.test/');
check('Sign-up with instant session → signed in (name saved, email lower-case)',
  su.ok && su.needsConfirmation === false && su.user?.id === 'acc-1' && e.calls[0].args.email === 'ravi@example.test' &&
  e.calls[0].args.options.data.full_name === 'Ravi Kumar' && e.calls[0].args.options.emailRedirectTo === 'https://app.example.test/');
e = fakeAuth({ signUp: () => ({ data: { user: authUser({}, { identities: [{}] }), session: null }, error: null }) });
su = await flow.signUpWithEmail(deps(e), good);
check('Email confirmation required → "check your email" (not signed in yet)', su.ok && su.needsConfirmation === true && !su.user && su.email === 'ravi@example.test');
e = fakeAuth({ signUp: () => ({ data: { user: authUser({}, { identities: [] }), session: null }, error: null }) });
su = await flow.signUpWithEmail(deps(e), good);
check('Email already registered → "log in instead"', !su.ok && su.errorKey === 'auth_err_already_registered');
e = fakeAuth({ signUp: () => ({ data: { user: null, session: null }, error: { message: 'User already registered', status: 422 } }) });
su = await flow.signUpWithEmail(deps(e), good);
check('Supabase "User already registered" → same message', !su.ok && su.errorKey === 'auth_err_already_registered');

e = fakeAuth({ signInWithPassword: () => ({ data: { user: null, session: null }, error: { message: 'Invalid login credentials', status: 400 } }) });
let li = await flow.signInWithEmail(deps(e), 'ravi@example.test', 'nope1234');
check('Wrong password → clear message', !li.ok && li.errorKey === 'auth_err_wrong_password');
e = fakeAuth({ signInWithPassword: () => ({ data: { user: null, session: null }, error: { message: 'Email not confirmed', status: 400 } }) });
li = await flow.signInWithEmail(deps(e), 'ravi@example.test', 'site2026build');
check('Unconfirmed email → message with resend', !li.ok && li.errorKey === 'auth_err_email_unconfirmed');
li = await flow.signInWithEmail(deps(e), 'ravi@example.test', '');
check('Empty password → message, no request', !li.ok && li.errorKey === 'auth_err_password_missing');
e = fakeAuth();
li = await flow.signInWithEmail(deps(e), ' Ravi@Example.test ', 'site2026build');
check('Correct email + password → signed in', li.ok && li.user.id === 'acc-1' && e.calls[0].args.email === 'ravi@example.test');

console.log('\n--- 6. Screens: loading states and messages in English and Tamil ---');
const login = read('src/views/LoginView.tsx');
const splash = read('src/components/auth/SplashScreen.tsx');
const used = new Set<string>();
for (const src of [login, splash, read('src/services/authFlow.ts'), read('src/views/SettingsView.tsx')]) {
  for (const m of src.matchAll(/['"](auth_[a-z_]+)['"]/g)) used.add(m[1]);
}
const missing = [...used].filter(k => !AUTH_DICTIONARY[k]?.en?.trim() || !AUTH_DICTIONARY[k]?.ta?.trim());
check(`Every message the screens use exists in English and Tamil (${used.size} keys)`, used.size > 60 && missing.length === 0, missing);
const html = read('index.html');
check('Before the app loads, index.html shows the same splash and nothing else on the page',
  /<div id="root"><div class="boot-shell"[\s\S]*?%APP_LOGO_SVG%[\s\S]*?<\/div><\/div>\s*<script type="module"/.test(html) && !html.includes('boot-block'));
check('Splash: logo + name + "Checking your account…"', splash.includes('<BrandLogo') && splash.includes("t('auth_checking')"));
check('Welcome: logo, tagline, Create Account (orange) and Log In (secondary)',
  login.includes('<BrandLogo size={72} stacked />') && login.includes("t('auth_tagline')") &&
  /id="welcome-create-account" className="auth-btn auth-btn-primary"/.test(login) && /id="welcome-log-in" className="auth-btn auth-btn-secondary"/.test(login));
check('Phone OTP and Email on both Create Account and Log In, with easy switching',
  login.includes('<MethodTabs') && login.includes('id="link-create-account"') && login.includes('id="link-log-in"') && login.includes('id="auth-back"'));
check('Buttons are disabled with a spinner while working; one request at a time',
  login.includes('disabled={busy || disabled}') && login.includes('auth-spinner') && login.includes('useSingleFlight') && login.includes("aria-busy={busy}"));
check('Offline and "not set up" warnings on the screens', login.includes("t('auth_offline_note')") && login.includes("t('auth_err_not_configured')"));
check('Language switch (EN / தமிழ்) on every auth screen', login.includes("setLang('ta')") && login.includes("setLang('en')"));
const css = read('src/styles/auth.css');
const tooSmall = [...css.matchAll(/font-size:\s*(\d+)px/g)].map(m => Number(m[1])).filter(px => px < 14);
const shortTaps = [...css.matchAll(/min-height:\s*(\d+)px/g)].map(m => Number(m[1])).filter(px => px < 44);
check('Auth styles: no text under 14px, no control under 44px', tooSmall.length === 0 && shortTaps.length === 0, { tooSmall, shortTaps });
check('Palette: orange #F97316, charcoal #1F2937, #FAFAF9 / #FFFFFF, success / danger / warning',
  ['#F97316', '#1F2937', '#FAFAF9', '#FFFFFF', '#16A34A', '#DC2626', '#F59E0B'].every(c => css.includes(c)));
check('friendlyAuthError never returns a key without a message', ['Failed to fetch', 'rate limit', 'Invalid login credentials', 'Email not confirmed', 'weird'].every(m => !!AUTH_DICTIONARY[flow.friendlyAuthError(new Error(m))]));

console.log(`\n✅ Welcome & sign-up flow: all ${passed} checks passed.\n`);
