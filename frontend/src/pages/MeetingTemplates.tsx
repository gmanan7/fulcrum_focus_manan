import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DB } from '@/integrations/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Loader2, Pencil, Users, Trash2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Template = {
  id: string;
  name: string;
  description: string | null;
  default_duration_minutes: number;
  default_start_time: string | null;
  default_location: string | null;
  is_active: boolean;
  factory_id: string;
  created_at: string;
  created_by: string | null;
};

type TemplateInvitee = {
  id: string;
  template_id: string;
  user_id: string;
  is_mandatory: boolean;
  created_at: string;
  profile?: { full_name: string };
  department?: string;
};

export default function MeetingTemplates() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [inviteesTemplateId, setInviteesTemplateId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['meeting-templates'],
    queryFn: async () => {
      const { data, error } = await DB
        .from('meeting_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
  });

  const { data: inviteeCounts } = useQuery({
    queryKey: ['template-invitee-counts'],
    queryFn: async () => {
      const { data, error } = await DB
        .from('meeting_template_invitees')
        .select('template_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((r) => {
        counts[r.template_id] = (counts[r.template_id] || 0) + 1;
      });
      return counts;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await DB.from('meeting_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Template deleted' });
      queryClient.invalidateQueries({ queryKey: ['meeting-templates'] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Meeting Templates</h1>
        <Button onClick={() => setShowCreate(true)} className="h-10 gap-1.5">
          <Plus className="h-4 w-4" /> {!isMobile && 'New Template'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !templates?.length ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No templates yet.</p>
      ) : isMobile ? (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{t.name}</p>
                  <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                    {t.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t.default_duration_minutes} min · {t.default_start_time?.slice(0, 5) || '—'} · {inviteeCounts?.[t.id] || 0} invitees</p>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setEditTemplate(t)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => setInviteesTemplateId(t.id)}><Users className="h-3.5 w-3.5 mr-1" />Invitees</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Duration</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Default Time</th>
                <th className="text-center p-3 text-sm font-medium text-muted-foreground">Invitees</th>
                <th className="text-center p-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="p-3 text-sm font-medium">{t.name}</td>
                  <td className="p-3 text-sm text-muted-foreground">{t.default_duration_minutes} min</td>
                  <td className="p-3 text-sm text-muted-foreground">{t.default_start_time?.slice(0, 5) || '—'}</td>
                  <td className="p-3 text-sm text-center">{inviteeCounts?.[t.id] || 0}</td>
                  <td className="p-3 text-center">
                    <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {t.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditTemplate(t)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setInviteesTemplateId(t.id)} title="Manage Invitees"><Users className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(t.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TemplateFormDialog
        open={showCreate || !!editTemplate}
        onOpenChange={(v) => { if (!v) { setShowCreate(false); setEditTemplate(null); } }}
        template={editTemplate}
        onSaved={(id) => { setShowCreate(false); setEditTemplate(null); setInviteesTemplateId(id); }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>Existing meetings will not be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ManageInviteesSheet templateId={inviteesTemplateId} onClose={() => setInviteesTemplateId(null)} />
    </div>
  );
}

/* ── Template Create/Edit Modal ── */
function TemplateFormDialog({ open, onOpenChange, template, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; template: Template | null; onSaved: (id: string) => void;
}) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [startTime, setStartTime] = useState('09:00');
  const [location, setLocation] = useState('');

  const isEdit = !!template;

  // Reset form when template changes
  useState(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setDuration(template.default_duration_minutes);
      setStartTime(template.default_start_time?.slice(0, 5) || '09:00');
      setLocation(template.default_location || '');
    } else {
      setName(''); setDescription(''); setDuration(30); setStartTime('09:00'); setLocation('');
    }
  });

  const { data: factory } = useQuery({
    queryKey: ['factory-for-template'],
    queryFn: async () => {
      const { data } = await DB.from('factory').select('id').limit(1).single();
      return data;
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const { error } = await DB.from('meeting_templates').update({
          name, description: description || null,
          default_duration_minutes: duration,
          default_start_time: startTime || null,
          default_location: location || null,
        }).eq('id', template!.id);
        if (error) throw error;
        return template!.id;
      } else {
        if (!factory) throw new Error('No factory found');
        const { data, error } = await DB.from('meeting_templates').insert({
          name, description: description || null,
          default_duration_minutes: duration,
          default_start_time: startTime || null,
          default_location: location || null,
          factory_id: factory.id,
          created_by: user!.id,
        }).select('id').single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (id) => {
      toast({ title: isEdit ? 'Template updated' : 'Template created' });
      queryClient.invalidateQueries({ queryKey: ['meeting-templates'] });
      onSaved(id);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(isMobile && 'h-full max-h-full w-full max-w-full rounded-none border-0', 'sm:max-w-lg')}>
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Template' : 'New Template'}</DialogTitle></DialogHeader>
        <div className="space-y-4 overflow-y-auto">
          <div><Label>Template Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. "T4 Daily Review"' className="h-11 mt-1" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="mt-1" rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Duration (min) *</Label><Input type="number" min={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-11 mt-1" /></div>
            <div><Label>Default Start Time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-11 mt-1" /></div>
          </div>
          <div><Label>Default Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" className="h-11 mt-1" /></div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending} className="w-full sm:w-auto h-11">
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? 'Save Changes' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Manage Invitees Sheet ── */
function ManageInviteesSheet({ templateId, onClose }: { templateId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: invitees, isLoading } = useQuery({
    queryKey: ['template-invitees', templateId],
    queryFn: async () => {
      const { data, error } = await DB
        .from('meeting_template_invitees')
        .select('*, profile:profiles!meeting_template_invitees_user_id_fkey(full_name)')
        .eq('template_id', templateId!);
      if (error) throw error;
      // Get departments for each user
      const userIds = data.map((d) => d.user_id);
      const { data: depts } = await DB
        .from('user_departments')
        .select('user_id, department:department!user_departments_department_id_fkey(name)')
        .in('user_id', userIds)
        .eq('is_primary', true);
      const deptMap: Record<string, string> = {};
      depts?.forEach((d: any) => { deptMap[d.user_id] = d.department?.name || ''; });
      return data.map((d: any) => ({ ...d, department: deptMap[d.user_id] || '' })) as TemplateInvitee[];
    },
    enabled: !!templateId,
  });

  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-invitees', search],
    queryFn: async () => {
      let q = DB.from('profiles').select('id, full_name').eq('is_active', true).order('full_name');
      if (search) q = q.ilike('full_name', `%${search}%`);
      const { data } = await q.limit(20);
      return data || [];
    },
    enabled: !!templateId,
  });

  const addMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await DB.from('meeting_template_invitees').insert({
        template_id: templateId!, user_id: userId, is_mandatory: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-invitees', templateId] });
      queryClient.invalidateQueries({ queryKey: ['template-invitee-counts'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await DB.from('meeting_template_invitees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-invitees', templateId] });
      queryClient.invalidateQueries({ queryKey: ['template-invitee-counts'] });
    },
  });

  const toggleMandatory = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await DB.from('meeting_template_invitees').update({ is_mandatory: val }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['template-invitees', templateId] }),
  });

  const existingUserIds = new Set(invitees?.map((i) => i.user_id) || []);
  const filteredUsers = allUsers?.filter((u) => !existingUserIds.has(u.id)) || [];

  return (
    <Sheet open={!!templateId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Manage Invitees</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-4">
          {/* Search & add */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users to add…" className="pl-9 h-10" />
          </div>
          {search && filteredUsers.length > 0 && (
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {filteredUsers.map((u) => (
                <button key={u.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between" onClick={() => { addMutation.mutate(u.id); setSearch(''); }}>
                  <span>{u.full_name}</span>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {/* Current invitees */}
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !invitees?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">No invitees added yet.</p>
          ) : (
            <div className="space-y-2">
              {invitees.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-2 rounded-md border bg-card">
                  <div>
                    <p className="text-sm font-medium">{(inv as any).profile?.full_name}</p>
                    {inv.department && <p className="text-xs text-muted-foreground">{inv.department}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Switch checked={inv.is_mandatory} onCheckedChange={(v) => toggleMandatory.mutate({ id: inv.id, val: v })} />
                      <span className="text-[10px] text-muted-foreground">{inv.is_mandatory ? 'Mandatory' : 'Optional'}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMutation.mutate(inv.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
