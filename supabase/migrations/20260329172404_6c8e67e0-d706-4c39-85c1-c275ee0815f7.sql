
CREATE TABLE meeting_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factory(id),
  name text NOT NULL,
  description text,
  default_duration_minutes int NOT NULL DEFAULT 30,
  default_start_time time,
  default_location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

CREATE TABLE meeting_template_invitees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES meeting_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  is_mandatory boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meeting_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_read" ON meeting_templates 
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "templates_write" ON meeting_templates 
  FOR ALL USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

ALTER TABLE meeting_template_invitees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_invitees_all" ON meeting_template_invitees 
  FOR ALL USING (auth.role() = 'authenticated');
