
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    BEGIN
      INSERT INTO audit_logs (table_name, record_id, action, new_values, performed_by)
      VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Audit log insert failed for % on %: %', NEW.id, TG_TABLE_NAME, SQLERRM;
    END;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    BEGIN
      INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, performed_by)
      VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Audit log update failed for % on %: %', NEW.id, TG_TABLE_NAME, SQLERRM;
    END;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    BEGIN
      INSERT INTO audit_logs (table_name, record_id, action, old_values, performed_by)
      VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Audit log delete failed for % on %: %', OLD.id, TG_TABLE_NAME, SQLERRM;
    END;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
