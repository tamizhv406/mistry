import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const permissionScopes = ['users', 'projects', 'labour', 'payroll', 'materials', 'expenses', 'floor_plans', 'estimates'];

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed.' });
  if (Number(request.headers.get('content-length') || 0) > 16_384) {
    return response(413, { error: 'Request is too large.' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return response(500, { error: 'Admin invite service is not configured.' });
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return response(401, { error: 'Sign in is required.' });
  const token = authorization.slice('Bearer '.length);
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authMail = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await caller.auth.getUser(token);
  if (authError || !authData.user) return response(401, { error: 'The sign-in session is invalid.' });

  const { data: member, error: memberError } = await service
    .from('mistry_members')
    .select('role,is_active')
    .eq('user_id', authData.user.id)
    .single();
  if (memberError || member?.role !== 'SUPER_ADMIN' || !member.is_active) {
    return response(403, { error: 'Only an active Super Admin can invite Sub-admins.' });
  }

  let body: {
    action?: string;
    email?: string;
    fullName?: string;
    username?: string;
    mobile?: string;
    targetUserId?: string;
    permissions?: Record<string, { read?: boolean; write?: boolean }>;
  };
  try {
    body = await request.json();
  } catch {
    return response(400, { error: 'Request body must be valid JSON.' });
  }
  if (body.action === 'send_password_recovery') {
    const targetUserId = body.targetUserId?.trim() || '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
      return response(400, { error: 'A valid account id is required.' });
    }
    const { data: target, error: targetError } = await service
      .from('mistry_members')
      .select('email')
      .eq('user_id', targetUserId)
      .single();
    if (targetError || !target?.email) return response(404, { error: 'Account not found.' });

    const { error: recoveryError } = await authMail.auth.resetPasswordForEmail(target.email);
    if (recoveryError) return response(400, { error: recoveryError.message });

    const { error: auditError } = await service.from('mistry_admin_audit').insert({
      actor_id: authData.user.id,
      target_user_id: targetUserId,
      action: 'PASSWORD_RECOVERY_SENT',
      details: { method: 'email' },
    });
    if (auditError) return response(500, { error: 'Recovery email sent, but audit logging failed.' });
    return response(200, { success: true });
  }

  const email = body.email?.trim().toLowerCase() || '';
  const fullName = body.fullName?.trim() || '';
  const username = body.username?.trim().toLowerCase() || '';
  const mobile = body.mobile?.trim() || '';
  if (body.action !== 'invite_sub_admin' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return response(400, { error: 'A valid Sub-admin email address is required.' });
  }
  const permissions = body.permissions || {};
  if (Object.keys(permissions).some(scope => !permissionScopes.includes(scope)) ||
      Object.values(permissions).some(value =>
        !value || typeof value !== 'object' ||
        (value.read !== undefined && typeof value.read !== 'boolean') ||
        (value.write !== undefined && typeof value.write !== 'boolean')
      )) {
    return response(400, { error: 'Sub-admin permissions contain invalid scopes or values.' });
  }

  const { data: invitation, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, username, mobile },
  });
  if (inviteError || !invitation.user) {
    return response(400, { error: inviteError?.message || 'Could not send the account invitation.' });
  }

  const { error: accessError } = await caller.rpc('mistry_set_member_access', {
    target_user_id: invitation.user.id,
    target_role: 'SUB_ADMIN',
    target_active: true,
    target_permissions: permissions,
  });
  if (accessError) {
    await service.from('mistry_admin_audit').insert({
      actor_id: authData.user.id,
      target_user_id: invitation.user.id,
      action: 'SUB_ADMIN_INVITE_ACCESS_FAILED',
      details: { email, error: accessError.message },
    });
    return response(500, { error: `Invitation sent, but account access setup failed: ${accessError.message}` });
  }

  return response(200, { userId: invitation.user.id });
});
