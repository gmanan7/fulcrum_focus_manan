import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DB } from '@/integrations/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Plus, Search, X, Columns3, ListTodo, Lightbulb, RotateCcw, Loader2, User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  PIP_DEPARTMENT_ID,
  PD_STAGE_LABEL,
  PD_STAGE_PILL,
  KANBAN_COLUMNS,
  isPDTeam,
  isTerminalStage,
  ageInDays,
  pdJobMatchesQuery,
  columnForStage,
  type PDStage,
} from '@/lib/pdCycle';
import { PDJobDrawer } from '@/components/pd/PDJobDrawer';

interface PDJobRow {
  id: string;
  job_number: number;
  factory_id: string;
  title: string;
  customer: string | null;
  product: string | null;
  substrate: string | null;
  stage: PDStage;
  feedback_note: string | null;
  previous_job_id: string | null;
  respawn_reason: string | null;
  target_dispatch_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  creator?: { full_name: string | null } | null;
  previous?: { job_number: number } | null;
}

const STAGE_CHIPS: { key: PDStage; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'in_process', label: 'In Process' },
  { key: 'processing_finished', label: 'Processing Finished' },
  { key: 'feedback_approved', label: 'Approved' },
  { key: 'feedback_rejected', label: 'Rejected' },
  { key: 'abandoned', label: 'Abandoned' },
];

export default function PDCycle() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();

  // Load user's departments (so we can compute isPDTeam reactively)
  const { data: userDeptIds = [] } = useQuery({
    queryKey: ['user-departments', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await DB
        .from('user_departments')
        .select('department_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.department_id);
    },
  });

  const canManage = isPDTeam(roles, userDeptIds);

  // Factory (single-factory project)
  const { data: factory } = useQuery({
    queryKey: ['factory-singleton'],
    queryFn: async () => {
      const { data, error } = await DB.from('factory').select('id, name').limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['pd-jobs'],
    queryFn: async () => {
      const { data, error } = await DB
        .from('pd_jobs')
        .select(`
          *,
          creator:profiles!pd_jobs_created_by_fkey(full_name),
          previous:pd_jobs!pd_jobs_previous_job_id_fkey(job_number)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PDJobRow[];
    },
  });

  // Latest stage_history entry per job to compute "age in stage"
  const { data: latestStageMap = {} } = useQuery({
    queryKey: ['pd-latest-stage'],
    queryFn: async () => {
      const { data, error } = await DB
        .from('pd_stage_history')
        .select('job_id, changed_at')
        .order('changed_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of (data ?? []) as any[]) {
        if (!map[r.job_id]) map[r.job_id] = r.changed_at;
      }
      return map;
    },
  });

  // Latest comment per job (for card preview)
  const { data: latestCommentMap = {} } = useQuery({
    queryKey: ['pd-latest-comment'],
    queryFn: async () => {
      const { data, error } = await DB
        .from('pd_job_comments')
        .select('job_id, body, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, { body: string; created_at: string }> = {};
      for (const r of (data ?? []) as any[]) {
        if (!map[r.job_id]) map[r.job_id] = { body: r.body, created_at: r.created_at };
      }
      return map;
    },
  });

  // UI state
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [stageChips, setStageChips] = useState<Set<PDStage>>(new Set());
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [myJobsOnly, setMyJobsOnly] = useState(false);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Cmd/Ctrl+K focuses the search box
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const el = document.getElementById('pd-search') as HTMLInputElement | null;
        el?.focus();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const customers = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => j.customer && set.add(j.customer));
    return Array.from(set).sort();
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (!pdJobMatchesQuery(j, search)) return false;
      if (stageChips.size > 0 && !stageChips.has(j.stage)) return false;
      if (customerFilter !== 'all' && j.customer !== customerFilter) return false;
      if (myJobsOnly && j.created_by !== user?.id) return false;
      return true;
    });
  }, [jobs, search, stageChips, customerFilter, myJobsOnly, user?.id]);

  const toggleChip = (s: PDStage) => {
    setStageChips((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  // Create job
  const [createForm, setCreateForm] = useState({
    title: '', customer: '', product: '', substrate: '', target_dispatch_date: '',
  });
  const resetCreate = () => setCreateForm({ title: '', customer: '', product: '', substrate: '', target_dispatch_date: '' });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user?.id || !factory?.id) throw new Error('Missing user or factory context');
      if (!createForm.title.trim()) throw new Error('Title is required');
      const { error } = await DB.from('pd_jobs').insert({
        factory_id: factory.id,
        title: createForm.title.trim(),
        customer: createForm.customer.trim() || null,
        product: createForm.product.trim() || null,
        substrate: createForm.substrate.trim() || null,
        target_dispatch_date: createForm.target_dispatch_date || null,
        created_by: user.id,
        job_number: 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'PD job created' });
      resetCreate();
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['pd-jobs'] });
    },
    onError: (e: any) => toast({ title: 'Could not create job', description: e.message, variant: 'destructive' }),
  });

  const openJob = jobs.find((j) => j.id === openJobId) ?? null;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">PD Cycle</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Product development jobs through their 4-stage lifecycle</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="kanban"><Columns3 className="h-4 w-4 mr-1" />Kanban</TabsTrigger>
              <TabsTrigger value="list"><ListTodo className="h-4 w-4 mr-1" />List</TabsTrigger>
            </TabsList>
          </Tabs>
          {canManage && (
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> New PD Job
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="pd-search"
              placeholder="Search title, customer, product, PD#…  (Ctrl/⌘K)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All customers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STAGE_CHIPS.map((c) => {
            const active = stageChips.has(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleChip(c.key)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  active
                    ? cn(PD_STAGE_PILL[c.key], 'border-transparent')
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                {c.label}
              </button>
            );
          })}
          <button
            onClick={() => setMyJobsOnly((v) => !v)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors',
              myJobsOnly ? 'bg-primary/10 text-primary border-transparent' : 'border-border text-muted-foreground hover:bg-muted'
            )}
          >
            My jobs
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : jobs.length === 0 ? (
        <EmptyState canManage={canManage} onCreate={() => setCreateOpen(true)} />
      ) : view === 'kanban' ? (
        <KanbanView
          jobs={filteredJobs}
          latestStageMap={latestStageMap}
          latestCommentMap={latestCommentMap}
          onOpen={setOpenJobId}
        />
      ) : (
        <ListView
          jobs={filteredJobs}
          latestStageMap={latestStageMap}
          latestCommentMap={latestCommentMap}
          onOpen={setOpenJobId}
        />
      )}

      {/* Drawer */}
      <PDJobDrawer
        job={openJob as any}
        open={!!openJob}
        canManage={canManage}
        onClose={() => setOpenJobId(null)}
        onNavigateToJob={(id) => setOpenJobId(id)}
      />

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create PD Job</DialogTitle>
            <DialogDescription>New jobs start in the Upcoming stage. Job number is auto-assigned.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Customer</Label>
                <Input value={createForm.customer} onChange={(e) => setCreateForm({ ...createForm, customer: e.target.value })} />
              </div>
              <div>
                <Label>Product</Label>
                <Input value={createForm.product} onChange={(e) => setCreateForm({ ...createForm, product: e.target.value })} />
              </div>
              <div>
                <Label>Substrate</Label>
                <Input value={createForm.substrate} onChange={(e) => setCreateForm({ ...createForm, substrate: e.target.value })} />
              </div>
              <div>
                <Label>Target Dispatch Date</Label>
                <Input type="date" value={createForm.target_dispatch_date}
                  onChange={(e) => setCreateForm({ ...createForm, target_dispatch_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !createForm.title.trim()}>
              {createMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ canManage, onCreate }: { canManage: boolean; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Lightbulb className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">No PD jobs yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        PD jobs track product development from upcoming work all the way to customer feedback.
      </p>
      {canManage && (
        <Button className="mt-5" onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1" /> Create your first PD job
        </Button>
      )}
    </div>
  );
}

function JobCard({
  job, latestStageMap, latestCommentMap, onOpen,
}: {
  job: PDJobRow;
  latestStageMap: Record<string, string>;
  latestCommentMap: Record<string, { body: string; created_at: string }>;
  onOpen: (id: string) => void;
}) {
  const ageBasis = latestStageMap[job.id] || job.created_at;
  const days = ageInDays(ageBasis);
  const lastComment = latestCommentMap[job.id];
  const terminal = isTerminalStage(job.stage);
  return (
    <Card
      onClick={() => onOpen(job.id)}
      className="cursor-pointer hover:border-primary/40 transition-colors"
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs font-mono text-muted-foreground">PD#{job.job_number}</div>
          {terminal && (
            <Badge className={cn('text-[10px] border-0', PD_STAGE_PILL[job.stage])}>
              {PD_STAGE_LABEL[job.stage]}
            </Badge>
          )}
        </div>
        <div className="text-sm font-medium text-foreground line-clamp-2">{job.title}</div>
        {job.customer && <div className="text-xs text-muted-foreground">Customer: {job.customer}</div>}
        <div className="text-xs text-muted-foreground">
          Target dispatch: {job.target_dispatch_date ? format(new Date(job.target_dispatch_date), 'd MMM yyyy') : '—'}
        </div>
        {lastComment && (
          <div className="text-xs text-muted-foreground italic line-clamp-1">
            “{lastComment.body}” — {formatDistanceToNow(new Date(lastComment.created_at), { addSuffix: true })}
          </div>
        )}
        <div className="text-[11px] text-muted-foreground">Age in stage: {days}d</div>
        {job.previous_job_id && job.previous && (
          <div className="text-[11px] text-primary inline-flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> from PD#{job.previous.job_number}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KanbanView({
  jobs, latestStageMap, latestCommentMap, onOpen,
}: {
  jobs: PDJobRow[];
  latestStageMap: Record<string, string>;
  latestCommentMap: Record<string, { body: string; created_at: string }>;
  onOpen: (id: string) => void;
}) {
  const byCol = useMemo(() => {
    const acc: Record<string, PDJobRow[]> = { upcoming: [], in_process: [], processing_finished: [], closed: [] };
    for (const j of jobs) acc[columnForStage(j.stage)].push(j);
    return acc;
  }, [jobs]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
      {KANBAN_COLUMNS.map((col) => (
        <div key={col.key} className="flex-shrink-0 w-72 md:w-80">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
            <span className="text-xs text-muted-foreground">{byCol[col.key].length}</span>
          </div>
          <div className="bg-muted/40 rounded-lg p-2 space-y-2 min-h-[200px]">
            {byCol[col.key].length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">No jobs</div>
            ) : (
              byCol[col.key].map((j) => (
                <JobCard key={j.id} job={j} latestStageMap={latestStageMap} latestCommentMap={latestCommentMap} onOpen={onOpen} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListView({
  jobs, latestStageMap, latestCommentMap, onOpen,
}: {
  jobs: PDJobRow[];
  latestStageMap: Record<string, string>;
  latestCommentMap: Record<string, { body: string; created_at: string }>;
  onOpen: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<'stage' | 'customer' | 'target' | 'created'>('created');
  const sorted = useMemo(() => {
    const arr = [...jobs];
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'stage': return a.stage.localeCompare(b.stage);
        case 'customer': return (a.customer || '').localeCompare(b.customer || '');
        case 'target': return (a.target_dispatch_date || '9999').localeCompare(b.target_dispatch_date || '9999');
        case 'created': return b.created_at.localeCompare(a.created_at);
      }
    });
    return arr;
  }, [jobs, sortKey]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <Th onClick={() => setSortKey('created')}>PD#</Th>
              <th className="text-left px-3 py-2">Title</th>
              <Th onClick={() => setSortKey('customer')}>Customer</Th>
              <Th onClick={() => setSortKey('stage')}>Stage</Th>
              <Th onClick={() => setSortKey('target')}>Target Dispatch</Th>
              <th className="text-left px-3 py-2">Last Activity</th>
              <th className="text-left px-3 py-2">Created By</th>
              <th className="text-left px-3 py-2">Age in Stage</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((j) => {
              const days = ageInDays(latestStageMap[j.id] || j.created_at);
              const last = latestCommentMap[j.id];
              return (
                <tr key={j.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => onOpen(j.id)}>
                  <td className="px-3 py-2 font-mono text-xs">PD#{j.job_number}</td>
                  <td className="px-3 py-2 font-medium">{j.title}</td>
                  <td className="px-3 py-2">{j.customer || '—'}</td>
                  <td className="px-3 py-2">
                    <Badge className={cn('border-0', PD_STAGE_PILL[j.stage])}>{PD_STAGE_LABEL[j.stage]}</Badge>
                  </td>
                  <td className="px-3 py-2">{j.target_dispatch_date ? format(new Date(j.target_dispatch_date), 'd MMM yyyy') : '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {last ? formatDistanceToNow(new Date(last.created_at), { addSuffix: true }) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">{j.creator?.full_name || '—'}</td>
                  <td className="px-3 py-2 text-xs">{days}d</td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="text-center text-muted-foreground py-8">No matching jobs</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th
      onClick={onClick}
      className={cn('text-left px-3 py-2', onClick && 'cursor-pointer hover:text-foreground')}
    >
      {children}
    </th>
  );
}
