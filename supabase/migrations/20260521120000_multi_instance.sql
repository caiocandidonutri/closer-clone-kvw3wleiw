-- Seed User
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'caiocandidonutri@hotmail.com') THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'caiocandidonutri@hotmail.com',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Dr. Caio Cândido"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '', NULL, '', '', ''
    );
  END IF;
END $$;

-- Update Schema for multiple instances per user
ALTER TABLE public.user_integrations DROP CONSTRAINT IF EXISTS user_integrations_user_id_key;
DROP INDEX IF EXISTS user_integrations_user_id_key;

-- Add instance_id to contacts to isolate numbers
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS instance_id uuid REFERENCES public.user_integrations(id) ON DELETE CASCADE;

-- Drop old unique constraint and create the new one
ALTER TABLE public.whatsapp_contacts DROP CONSTRAINT IF EXISTS whatsapp_contacts_user_id_remote_jid_key;
DROP INDEX IF EXISTS whatsapp_contacts_user_id_remote_jid_key;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_contacts_user_instance_jid_idx ON public.whatsapp_contacts(user_id, instance_id, remote_jid);
ALTER TABLE public.whatsapp_contacts DROP CONSTRAINT IF EXISTS whatsapp_contacts_user_instance_jid_key;
ALTER TABLE public.whatsapp_contacts ADD CONSTRAINT whatsapp_contacts_user_instance_jid_key UNIQUE USING INDEX whatsapp_contacts_user_instance_jid_idx;
