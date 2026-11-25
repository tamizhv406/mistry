/**
 * Security (task sheet, Task 1): no built-in accounts, passwords or keys in the app; sign-in goes
 * through Supabase only; admin rights come only from the membership table.
 */
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

/** Every text file the app or its tooling is built from (not node_modules, build output or docs about keys). */
function appFiles(): string[] {
  const out: string[] = [];
  const skip = new Set(['node_modules', 'dist', '.git', 'android', '.agents', 'docs', 'supabase', 'tests']);
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?|mjs|cjs|json|html|env|toml)$/.test(e.name) && e.name !== 'package-lock.json') out.push(p);
    }
  };
  walk(root);
  return out;
}

const files = appFiles();
const hits = (re: RegExp) => files.filter(f => re.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(root, f));

console.log('\n--- 1. No backdoor, no built-in credentials ---');
const login = read('src/views/LoginView.tsx');
check('The Super Admin direct login is gone', !/handleSuperAdminDirectLogin|super-admin-tamizh/.test(login));
check('No hardcoded admin email or password anywhere in the app', hits(/tamilthilagan82|tamizh406/).length === 0, hits(/tamilthilagan82|tamizh406/));
check('No password is checked against the device database', !/passwordHash\s*===/.test(login) && hits(/passwordHash\s*===\s*password/).length === 0);
check('Registration and reset never store a password on the device', !/passwordHash:\s*regPassword/.test(login) && !/passwordHash\s*=\s*resetNewPassword/.test(login));
check('No hardcoded security answers', !/nameAnswer:\s*'Tamizh'/.test(login));
check('The unused local-password modals and the admin provisioning script are removed',
  !fs.existsSync(path.join(root, 'src/components/ForgotPasswordModal.tsx')) && !fs.existsSync(path.join(root, 'src/components/RegistrationModal.tsx')) &&
  !fs.existsSync(path.join(root, 'scripts/admin_create_user.ts')));

console.log('\n--- 2. Keys only from the environment ---');
check('No Supabase project URL is built in', hits(/[a-z0-9]{20}\.supabase\.co/).length === 0, hits(/[a-z0-9]{20}\.supabase\.co/));
check('No Supabase key or JWT is built in', hits(/sb_publishable_[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9_-]{10,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}/).length === 0);
check('No service_role key is used or asked for in the app', hits(/service_role|SERVICE_ROLE/i).length === 0, hits(/service_role|SERVICE_ROLE/i));
const client = read('lib/supabaseClient.ts');
check('The client reads VITE_ / NEXT_PUBLIC_ settings and falls back to "not configured"', client.includes('VITE_SUPABASE_URL') && client.includes("VITE_SUPABASE_ANON_KEY") && client.includes('supabase-not-configured.invalid'));

console.log('\n--- 3. Admin rights only from the server ---');
const cloudAuth = read('src/services/cloudAuth.ts');
check('No admin-by-email list or setting', !/SUPER_ADMIN_EMAILS|isConfiguredSuperAdmin|VITE_SUPER_ADMIN_EMAIL/.test(cloudAuth));
check('user_metadata (editable by the user) never grants a role', !/user_metadata\?*\.role/.test(cloudAuth));

console.log('\n--- 4. Files and ignore rules ---');
check('src/db/db.env is removed', !fs.existsSync(path.join(root, 'src/db/db.env')));
check('The duplicate nested mistry-main/ copy is removed', !fs.existsSync(path.join(root, 'mistry-main')));
const gi = read('.gitignore').split(/\r?\n/).map(l => l.trim());
check('.env and .env.* are ignored; .env.example is kept', gi.includes('.env') && gi.includes('.env.*') && gi.includes('!.env.example') &&
  gi.lastIndexOf('!.env.example') > gi.lastIndexOf('.env.*') && !gi.includes('.env*'));
check('.env.example holds no values', read('.env.example').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .every(l => l.slice(l.indexOf('=') + 1).trim() === ''));

console.log(`\n✅ Security cleanup: all ${passed} checks passed.\n`);
