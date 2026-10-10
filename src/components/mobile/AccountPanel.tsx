import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Trash2 } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../services/supabase';
import { getCurrentUser } from '../../services/auth';
import { readCloudStatus, runCloudSync } from '../../services/cloudSync';
import { deleteAccountAndData } from '../../services/account';
import { formatDateTime } from '../../utils/datetime';
import { Field, Note, Sheet } from './kit';

/**
 * Cloud backup (Supabase) and account deletion. Records always save to this phone first;
 * cloud backup is an extra copy the user signs in to.
 */
export const AccountPanel: React.FC<{ onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void }> = ({ onNotify }) => {
  const user = getCurrentUser();
  const configured = isSupabaseConfigured() && !!supabase;
  const [cloudUser, setCloudUser] = useState<{ id: string; email: string } | null>(null);
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'' | 'signin' | 'signup' | 'sync' | 'delete'>('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [, refresh] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!configured || !supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive && data.session?.user) setCloudUser({ id: data.session.user.id, email: data.session.user.email || '' });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudUser(session?.user ? { id: session.user.id, email: session.user.email || '' } : null);
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, [configured]);

  if (!user) return null;
  const status = cloudUser ? readCloudStatus(cloudUser.id, user.id) : null;

  const sync = async () => {
    if (!supabase || busy) return;
    setBusy('sync');
    setError('');
    const res = await runCloudSync(supabase, user);
    setBusy('');
    refresh(n => n + 1);
    if (res.ok) {
      const { pushed, pulled, removed } = res.result;
      setInfo(pushed + pulled + removed === 0 ? 'Everything is already up to date.' : `Sent ${pushed}, received ${pulled}${removed ? `, removed ${removed}` : ''}.`);
    } else {
      setError(res.error);
    }
  };

  const authenticate = async (mode: 'signin' | 'signup') => {
    if (!supabase || busy) return;
    if (!email.trim() || !email.includes('@')) return setError('Enter your email address.');
    if (password.length < 8) return setError('The cloud password needs at least 8 characters.');
    setBusy(mode);
    setError('');
    setInfo('');
    try {
      const res = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
      if (res.error) {
        // What was typed stays in the form so it can be corrected or retried.
        setError(navigator.onLine === false ? 'No internet connection. Try again when you are online.' : res.error.message);
        return;
      }
      if (!res.data.session) {
        setInfo('Check your email and open the confirmation link, then sign in here.');
        return;
      }
      setPassword('');
      onNotify('Cloud backup is on', 'success');
      setBusy('');
      await sync();
    } catch (err) {
      setError((err as Error).message || 'Could not reach the cloud. Try again.');
    } finally {
      setBusy('');
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setInfo('');
    onNotify('Signed out of cloud backup. Your records stay on this phone.', 'info');
  };

  const deleteAccount = async () => {
    if (busy) return;
    if (cloudUser && navigator.onLine === false) {
      return setError('Connect to the internet first, so the cloud copy can be erased as well.');
    }
    setBusy('delete');
    setError('');
    const res = await deleteAccountAndData(user);
    if (!res.ok) {
      setBusy('');
      return setError(res.error);
    }
    let cloudErased = true;
    if (cloudUser && supabase) {
      const pushed = await runCloudSync(supabase, user); // sends the erase marks
      cloudErased = pushed.ok;
      await supabase.auth.signOut();
    }
    onNotify(
      cloudErased
        ? `Account deleted with ${res.records} record${res.records === 1 ? '' : 's'}.`
        : 'Account deleted on this phone. The cloud copy could not be reached; contact support to have it erased.',
      cloudErased ? 'info' : 'error'
    );
    window.location.reload();
  };

  return (
    <div className="m-page" style={{ padding: 0, margin: '0 0 20px', maxWidth: 'none' }}>
      <div className="m-card m-card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {cloudUser ? <Cloud size={22} className="is-ok" /> : <CloudOff size={22} className="is-muted" />}
          <strong style={{ fontSize: '1.05rem' }}>Cloud backup</strong>
        </div>

        {!configured ? (
          <p className="is-muted" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
            Cloud backup is not switched on in this version of the app. Your records are saved on this phone.
            Use <strong>Download backup</strong> below to keep a copy somewhere safe.
          </p>
        ) : cloudUser ? (
          <>
            <p style={{ fontSize: '0.92rem', color: 'var(--m-ink-2)' }}>
              Signed in as <strong>{cloudUser.email}</strong>.{' '}
              {status?.lastSyncedAt ? `Last synced ${formatDateTime(status.lastSyncedAt)}.` : 'Not synced yet.'}
            </p>
            {(error || status?.lastError) && <div style={{ marginTop: 10 }}><Note tone="bad" role="alert">{error || status?.lastError}</Note></div>}
            {info && !error && <div style={{ marginTop: 10 }}><Note tone="ok">{info}</Note></div>}
            <div className="m-btn-row" style={{ marginTop: 12 }}>
              <button type="button" className="m-btn is-primary" onClick={sync} disabled={!!busy}>
                <RefreshCw size={18} /> {busy === 'sync' ? 'Syncing…' : 'Sync now'}
              </button>
              <button type="button" className="m-btn" onClick={signOut} disabled={!!busy}>Sign out</button>
            </div>
            <p className="m-calc-note">
              Records save to this phone first and work offline. Sync copies them to your cloud account and brings in
              changes from your other devices. If the same record was changed in two places, the later change is kept.
            </p>
          </>
        ) : (
          <>
            <p className="is-muted" style={{ fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 12 }}>
              Keep a copy of your records online, and get them back on a new phone. This uses its own email and password.
            </p>
            {error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{error}</Note></div>}
            {info && <div style={{ marginBottom: 12 }}><Note>{info}</Note></div>}
            <Field label="Email">
              <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <Field label="Cloud password">
              <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </Field>
            <div className="m-btn-row">
              <button type="button" className="m-btn is-primary" onClick={() => authenticate('signin')} disabled={!!busy}>
                {busy === 'signin' ? 'Signing in…' : 'Sign in'}
              </button>
              <button type="button" className="m-btn" onClick={() => authenticate('signup')} disabled={!!busy}>
                {busy === 'signup' ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="m-card m-card-pad" style={{ marginTop: 12 }}>
        <strong style={{ fontSize: '1.05rem' }}>Delete my account</strong>
        <p className="is-muted" style={{ fontSize: '0.9rem', lineHeight: 1.5, margin: '6px 0 12px' }}>
          Removes your account, your projects and every record in them from this phone{cloudUser ? ' and from cloud backup' : ''}. This can not be undone.
        </p>
        <button type="button" className="m-btn" onClick={() => { setError(''); setConfirmText(''); setDeleteOpen(true); }}>
          <Trash2 size={18} /> Delete account and data
        </button>
      </div>

      <Sheet
        open={deleteOpen}
        title="Delete account and all data?"
        onClose={() => busy !== 'delete' && setDeleteOpen(false)}
        footer={
          <>
            <button type="button" className="m-btn" onClick={() => setDeleteOpen(false)} disabled={busy === 'delete'}>Cancel</button>
            <button type="button" className="m-btn is-danger" onClick={deleteAccount} disabled={busy === 'delete' || confirmText.trim().toLowerCase() !== user.username.toLowerCase()}>
              {busy === 'delete' ? 'Deleting…' : 'Delete everything'}
            </button>
          </>
        }
      >
        {error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{error}</Note></div>}
        <Note tone="warn">
          All your projects, floor plans, attendance, salary, material, tool and expense records will be erased
          {cloudUser ? ' here and in cloud backup' : ' from this phone'}. Download a backup first if you may need them.
        </Note>
        <div style={{ marginTop: 14 }}>
          <Field label={`Type your username (${user.username}) to confirm`}>
            <input type="text" autoComplete="off" autoCapitalize="none" value={confirmText} onChange={e => setConfirmText(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </div>
  );
};
