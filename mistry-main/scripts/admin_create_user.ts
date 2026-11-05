import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://kfnbabbknhzbjhxcozan.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbmJhYmJrbmh6YmpoeGNvemFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMjM1NjYsImV4cCI6MjEwNzY5OTU2Nn0.qZedOHNd7LOl_eu9Kyf4WZO53jcoCEMyT-W8bykY9fg';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.argv[4] || '';

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const password = process.argv[3] || '';

  if (!email || !password) {
    console.log('Usage: npx tsx scripts/admin_create_user.ts <email> <password> [service_role_key]');
    console.log('Example: npx tsx scripts/admin_create_user.ts tamilthilagan82@gmail.com tamizh406@##');
    process.exit(1);
  }

  console.log(`\n👑 Building Mistry Super Admin User Provisioner`);
  console.log(`Target Email: ${email}`);

  // 1. If service role key is available, use privileged admin API
  if (SERVICE_ROLE_KEY) {
    console.log('Using Supabase Service Role Key for instant confirmation...');
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      console.error('Error querying users with service key:', listError.message);
    } else {
      const existing = usersData.users.find(u => u.email?.toLowerCase() === email);
      if (existing) {
        console.log(`Found existing user ID: ${existing.id}. Updating password...`);
        const { error: updateError } = await adminClient.auth.admin.updateUserById(existing.id, {
          password: password,
          email_confirm: true,
          user_metadata: { role: 'SUPER_ADMIN', username: 'tamizh', full_name: 'Tamizh (Super Admin)' },
        });
        if (updateError) {
          console.error('Update failed:', updateError.message);
        } else {
          console.log('✅ SUCCESS: Password updated and account auto-confirmed!');
          console.log(`You can now sign in at https://tamizhv406.github.io/mistry/`);
          process.exit(0);
        }
      } else {
        console.log('Creating new user with auto-confirmation...');
        const { error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: 'SUPER_ADMIN', username: 'tamizh', full_name: 'Tamizh (Super Admin)' },
        });
        if (createError) {
          console.error('Creation failed:', createError.message);
        } else {
          console.log('✅ SUCCESS: New Super Admin user created with auto-confirmation!');
          process.exit(0);
        }
      }
    }
  }

  // 2. Client signUp fallback
  console.log('Attempting sign up with public client...');
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { role: 'SUPER_ADMIN', username: 'tamizh', full_name: 'Tamizh (Super Admin)' },
    },
  });

  if (error) {
    console.log(`\nNote: ${error.message}`);
  } else if (data.user) {
    console.log(`\nUser record registered (ID: ${data.user.id}).`);
  }

  console.log('\n--------------------------------------------------------------');
  console.log('💡 TIP FOR INSTANT LOGIN:');
  console.log('App has an Instant Super Admin Login button ready on the live site:');
  console.log('👉 Open: https://tamizhv406.github.io/mistry/');
  console.log('👉 Click: "👑 Super Admin Instant Login (tamizh)"');
  console.log('--------------------------------------------------------------\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

