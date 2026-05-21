DO $$
DECLARE
  new_user_id uuid;
  agent_id uuid;
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
      crypt('Skip@123456', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Dr. Caio Cândido"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL, '', '', ''
    );
  ELSE
    SELECT id INTO new_user_id FROM auth.users WHERE email = 'caiocandidonutri@hotmail.com';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ai_agents WHERE name = 'Yasa' AND user_id = new_user_id) THEN
    agent_id := gen_random_uuid();
    INSERT INTO public.ai_agents (
      id, user_id, name, description, system_prompt, gemini_api_key, is_active
    ) VALUES (
      agent_id,
      new_user_id,
      'Yasa',
      'Assistente de Triagem e Acolhimento',
      'Você é Yasa, uma assistente virtual focada no atendimento e triagem de pacientes para o Dr. Caio Cândido. Seu tom deve ser extremamente profissional, acolhedor e empático. Seu público-alvo são adultos (25-50 anos), principalmente mulheres na menopausa e homens com fadiga/exaustão. O foco do atendimento é saúde integrativa, autoestima, emagrecimento e análise cuidadosa de exames clínicos. Demonstre sempre muita empatia pelas dores relatadas, acolha o paciente e faça perguntas iniciais para entender melhor o quadro antes de encaminhar para a marcação de consulta.',
      'SET_YOUR_API_KEY_HERE',
      true
    );
  END IF;
END $$;

ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS last_message_from_me BOOLEAN;

DROP POLICY IF EXISTS "Users can manage their own AI agents" ON public.ai_agents;
CREATE POLICY "Users can manage their own AI agents" ON public.ai_agents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own contact identities" ON public.contact_identity;
CREATE POLICY "Users can manage their own contact identities" ON public.contact_identity FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own import jobs" ON public.import_jobs;
CREATE POLICY "Users can manage their own import jobs" ON public.import_jobs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own integrations" ON public.user_integrations;
CREATE POLICY "Users can manage their own integrations" ON public.user_integrations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own contacts" ON public.whatsapp_contacts;
CREATE POLICY "Users can manage their own contacts" ON public.whatsapp_contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own messages" ON public.whatsapp_messages;
CREATE POLICY "Users can manage their own messages" ON public.whatsapp_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.trg_update_contact_last_message()
RETURNS trigger AS $$
BEGIN
  UPDATE public.whatsapp_contacts
  SET last_message_at = NEW.timestamp,
      last_message_from_me = NEW.from_me
  WHERE id = NEW.contact_id
    AND (last_message_at IS NULL OR NEW.timestamp >= last_message_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_insert ON public.whatsapp_messages;
CREATE TRIGGER on_message_insert
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_contact_last_message();

DO $$
BEGIN
  UPDATE public.whatsapp_contacts c
  SET last_message_from_me = (
    SELECT from_me FROM public.whatsapp_messages m
    WHERE m.contact_id = c.id
    ORDER BY timestamp DESC
    LIMIT 1
  )
  WHERE last_message_from_me IS NULL;
END $$;
