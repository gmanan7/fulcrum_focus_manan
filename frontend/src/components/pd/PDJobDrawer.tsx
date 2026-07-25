import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { DB } from '@/integrations/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Send, Pencil, RotateCcw, Loader2, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PD_STAGE_LABEL, PD_STAGE_PILL, nextStageOptions, isTerminalStage,
  validateStageChange, type PDStage,
} from '@/lib/pdCycle';

interface Job {
  id: string;
  job_number: number;
  title: string;
  customer: string | null;
  product: string | null;
  substrate: string | null;
  stage: PDStage;
  feedback_note: string | null;
  target_dispatch_date: string | null;
  previous_job_id: string | null;
  respawn_reason: string | null;
  created_at: string;
  created_by: string | null;
  creator?: { full_name: string | null } | null;
  previous?: { job_number: number } | null;
}

interface Props {
  job: Job | null;
  open: boolean;
  canManage: boolean;
  onClose: () => void;
  onNavigateToJob: (id: string) => void;
}

export function PDJobDrawer({ job, open, canManage, onClose, onNavigateToJob }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [stageOpen, setStageOpen] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!open) { setStageOpen(false); setSpawnOpen(false); setEditOpen(false); setHistoryOpen(false); setComment(''); }
  }, [open, job?.id]);

  const { data: comments = [] } = useQuery({
    queryKey: ['pd-comments', job?.id],
    enabled: !!job?.id && open,
    queryFn: async () => {
      const { data, error } = await DB
        .from('pd_job_comments')
        .select('*, author:profiles!pd_job_comments_author_id_fkey(full_name)')
        .eq('job_id', job!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['pd-history', job?.id],
    enabled: !!job?.id && open,
    queryFn: async () => {
      const { data, error } = await DB
        .from('pd_stage_history')
        .select('*, changer:profiles!pd_stage_history_changed_by_fkey(full_name)')
        .eq('job_id', job!.id)
        .order('changed_at', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const postComment = useMutation({
    mutationFn: async () => {
      if (!user?.id || !job?.id || !comment.trim()) return;
      const { error } = await DB.from('pd_job_comments').insert({
        job_id: job.id, author_id: user.id, body: comment.trim(),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setComment('');
      qc.invalidateQueries({ queryKey: ['pd-comments', job?.id] });
      qc.invalidateQueries({ queryKey: ['pd-latest-comment'] });
    },
    onError: (e: any) => toast({ title: 'Could not post comment', description: e.message, variant: 'destructive' }),
  });

  if (!job) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-mono text-muted-foreground">PD#{job.job_number}</div>
              <SheetTitle className="text-lg leading-snug">{job.title}</SheetTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge className={cn('border-0', PD_STAGE_PILL[job.stage])}>{PD_STAGE_LABEL[job.stage]}</Badge>
                {job.customer && <span>· {job.customer}</span>}
                {job.product && <span>· {job.product}</span>}
                {job.substrate && <span>· {job.substrate}</span>}
                <span>· Target: {job.target_dispatch_date ? format(new Date(job.target_dispatch_date), 'd MMM yyyy') : '—'}</span>
              </div>
              {job.previous_job_id && job.previous && (
                <div className="mt-1.5 text-xs text-primary inline-flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" />
                  Respawned from PD#{job.previous.job_number}{job.respawn_reason && ` — ${job.respawn_reason}`}
                  <button onClick={() => onNavigateToJob(job.previous_job_id!)} className="underline ml-1">open</button>
                </div>
              )}
              <div className="mt-1 text-[11px] text-muted-foreground">
                Created by {job.creator?.full_name || '—'} · {format(new Date(job.created_at), 'd MMM yyyy HH:mm')}
              </div>
            </div>
            {canManage && (
              <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} title="Edit job">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="p-5 space-y-5">
          {/* a) Change Stage */}
          {canManage && !isTerminalStage(job.stage) && (
            <Button onClick={() => setStageOpen(true)} variant="outline" className="w-full">
              <ArrowRight className="h-4 w-4 mr-1" /> Change Stage
            </Button>
          )}

          {/* b) Feedback note */}
          {isTerminalStage(job.stage) && job.feedback_note && (
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="text-xs font-semibold text-foreground mb-1">Customer feedback</div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{job.feedback_note}</p>
            </div>
          )}

          {/* c) Comments */}
          <div>
            <div className="text-sm font-semibold text-foreground mb-2">Comments</div>
            <CommentLog comments={comments} />
            <div className="mt-3 flex gap-2">
              <Textarea
                placeholder="Write a comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <Button
                onClick={() => postComment.mutate()}
                disabled={!comment.trim() || postComment.isPending}
                size="icon"
                className="self-end"
              >
                {postComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* d) Spawn */}
          {canManage && (job.stage === 'feedback_rejected' || job.stage === 'abandoned') && (
            <Button onClick={() => setSpawnOpen(true)} variant="outline" className="w-full">
              <RotateCcw className="h-4 w-4 mr-1" /> Spawn new job from this
            </Button>
          )}

          {/* e) Stage history */}
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-foreground">
              {historyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Stage history ({history.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1.5">
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No stage changes yet.</p>
              ) : history.map((h) => (
                <div key={h.id} className="text-xs text-foreground">
                  <span className="text-muted-foreground">{h.from_stage ? PD_STAGE_LABEL[h.from_stage as PDStage] : '—'}</span>
                  <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                  <span className="font-medium">{PD_STAGE_LABEL[h.to_stage as PDStage]}</span>
                  <span className="text-muted-foreground"> · {h.changer?.full_name || '—'} · {formatDistanceToNow(new Date(h.changed_at), { addSuffix: true })}</span>
                  {h.note && <span className="text-muted-foreground"> · {h.note}</span>}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Modals */}
        <ChangeStageModal
          open={stageOpen}
          job={job}
          onClose={() => setStageOpen(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['pd-jobs'] });
            qc.invalidateQueries({ queryKey: ['pd-history', job.id] });
            qc.invalidateQueries({ queryKey: ['pd-latest-stage'] });
          }}
        />
        <SpawnModal
          open={spawnOpen}
          job={job}
          onClose={() => setSpawnOpen(false)}
          onDone={(newId) => {
            qc.invalidateQueries({ queryKey: ['pd-jobs'] });
            onNavigateToJob(newId);
          }}
        />
        <EditModal
          open={editOpen}
          job={job}
          onClose={() => setEditOpen(false)}
          onDone={() => qc.invalidateQueries({ queryKey: ['pd-jobs'] })}
        />
      </SheetContent>
    </Sheet>
  );
}

function CommentLog({ comments }: { comments: any[] }) {
  // Interleave stage transitions as dividers when stage_at_comment changes.
  if (comments.length === 0) {
    return <p className="text-xs text-muted-foreground">No comments yet.</p>;
  }
  const rows: { type: 'divider' | 'comment'; key: string; stage?: PDStage; data?: any }[] = [];
  let lastStage: PDStage | null = null;
  comments.forEach((c, i) => {
    const s = c.stage_at_comment as PDStage | null;
    if (s && s !== lastStage) {
      rows.push({ type: 'divider', key: `d-${i}`, stage: s });
      lastStage = s;
    }
    rows.push({ type: 'comment', key: c.id, data: c });
  });
  return (
    <div className="space-y-2">
      {rows.map((r) =>
        r.type === 'divider' ? (
          <div key={r.key} className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-border" />
            <Badge className={cn('text-[10px] border-0', PD_STAGE_PILL[r.stage!])}>{PD_STAGE_LABEL[r.stage!]}</Badge>
            <div className="flex-1 h-px bg-border" />
          </div>
        ) : (
          <div key={r.key} className="rounded-md border p-2.5 bg-card">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{r.data.author?.full_name || 'User'}</span>
              {' · '}
              {formatDistanceToNow(new Date(r.data.created_at), { addSuffix: true })}
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{r.data.body}</p>
          </div>
        )
      )}
    </div>
  );
}

function ChangeStageModal({
  open, job, onClose, onDone,
}: { open: boolean; job: Job; onClose: () => void; onDone: () => void }) {
  const [next, setNext] = useState<PDStage | ''>('');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');
  useEffect(() => { if (open) { setNext(''); setNote(''); setFeedback(''); } }, [open]);

  const options = nextStageOptions(job.stage);
  const requiresFeedback = next === 'feedback_rejected' || next === 'abandoned';

  const mut = useMutation({
    mutationFn: async () => {
      if (!next) throw new Error('Pick a stage');
      const check = validateStageChange({ current: job.stage, next, note, feedbackNote: feedback });
      if (!check.ok) throw new Error((check as { ok: false; error: string }).error);
      const { error } = await DB.rpc('update_pd_job_stage', {
        p_job_id: job.id,
        p_new_stage: next as any,
        p_note: note || null,
        p_feedback_note: feedback || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Stage updated' }); onDone(); onClose(); },
    onError: (e: any) => toast({ title: 'Could not change stage', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Stage</DialogTitle>
          <DialogDescription>Currently {PD_STAGE_LABEL[job.stage]}. Only forward transitions are allowed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>New stage *</Label>
            <Select value={next} onValueChange={(v) => setNext(v as PDStage)}>
              <SelectTrigger><SelectValue placeholder="Select stage…" /></SelectTrigger>
              <SelectContent>
                {options.map((o) => <SelectItem key={o} value={o}>{PD_STAGE_LABEL[o]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          {requiresFeedback && (
            <div>
              <Label>Feedback note *</Label>
              <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="What did the customer say?" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !next}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpawnModal({
  open, job, onClose, onDone,
}: { open: boolean; job: Job; onClose: () => void; onDone: (newId: string) => void }) {
  const [reason, setReason] = useState('');
  const [title, setTitle] = useState(job.title);
  const [date, setDate] = useState('');
  useEffect(() => { if (open) { setReason(''); setTitle(job.title); setDate(''); } }, [open, job.id, job.title]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error('Respawn reason is required');
      const { data, error } = await DB.rpc('spawn_pd_job_from', {
        p_source_job_id: job.id,
        p_respawn_reason: reason.trim(),
        p_new_title: title.trim(),
        p_new_target_dispatch_date: date || null,
      } as any);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: (newId) => { toast({ title: 'New PD job created' }); onClose(); onDone(newId); },
    onError: (e: any) => toast({ title: 'Could not spawn job', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Spawn new PD Job</DialogTitle>
          <DialogDescription>Starts a fresh job linked back to PD#{job.job_number}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Respawn reason *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>New title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>New target dispatch date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !reason.trim()}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditModal({
  open, job, onClose, onDone,
}: { open: boolean; job: Job; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    title: job.title, customer: job.customer || '', product: job.product || '',
    substrate: job.substrate || '', target_dispatch_date: job.target_dispatch_date || '',
  });
  useEffect(() => {
    if (open) setForm({
      title: job.title, customer: job.customer || '', product: job.product || '',
      substrate: job.substrate || '', target_dispatch_date: job.target_dispatch_date || '',
    });
  }, [open, job]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Title is required');
      const { error } = await DB.from('pd_jobs').update({
        title: form.title.trim(),
        customer: form.customer.trim() || null,
        product: form.product.trim() || null,
        substrate: form.substrate.trim() || null,
        target_dispatch_date: form.target_dispatch_date || null,
      } as any).eq('id', job.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Job updated' }); onDone(); onClose(); },
    onError: (e: any) => toast({ title: 'Could not update', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit PD Job</DialogTitle>
          <DialogDescription>Stage changes use the Change Stage flow.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Customer</Label><Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></div>
            <div><Label>Product</Label><Input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} /></div>
            <div><Label>Substrate</Label><Input value={form.substrate} onChange={(e) => setForm({ ...form, substrate: e.target.value })} /></div>
            <div><Label>Target Dispatch</Label><Input type="date" value={form.target_dispatch_date} onChange={(e) => setForm({ ...form, target_dispatch_date: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
