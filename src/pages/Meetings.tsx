import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Loader2, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-primary/10 text-primary',
  in_progress: 'bg-rag-amber/20 text-warning',
  completed: 'bg-rag-green/20 text-success',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function Meetings() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['meetings', statusFilter],
    queryFn: async () => {
      let q = supabase
        .from('meetings')
        .select('*, facilitator:profiles!meetings_facilitator_id_fkey(full_name)')
        .order('scheduled_date', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Meetings</h1>
        <Button onClick={() => setShowCreate(true)} className="h-10 gap-1.5">
          <Plus className="h-4 w-4" /> {!isMobile && 'New Meeting'}
        </Button>
      </div>

      {/* Filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full sm:w-48 h-10">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="scheduled">Scheduled</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !meetings?.length ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No meetings found.</p>
      ) : isMobile ? (
        <div className="space-y-3">
          {meetings.map((m) => (
            <Card key={m.id} className="cursor-pointer active:bg-muted/50" onClick={() => navigate(`/meetings/${m.id}/workspace`)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm leading-tight">{m.title}</p>
                  <Badge className={cn('text-[10px] shrink-0', STATUS_COLORS[m.status])}>{m.status.replace('_', ' ')}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{format(new Date(m.scheduled_date), 'dd MMM yyyy')}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.scheduled_start_time?.slice(0, 5)} – {m.scheduled_end_time?.slice(0, 5)}</span>
                </div>
                <p className="text-xs text-muted-foreground">Facilitator: {(m as any).facilitator?.full_name ?? '—'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Title</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Time</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Facilitator</th>
                <th className="text-center p-3 text-sm font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id} className="border-b last:border-0 cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/meetings/${m.id}/workspace`)}>
                  <td className="p-3 text-sm">{format(new Date(m.scheduled_date), 'dd MMM yyyy')}</td>
                  <td className="p-3 text-sm font-medium">{m.title}</td>
                  <td className="p-3 text-sm text-muted-foreground">{m.scheduled_start_time?.slice(0, 5)} – {m.scheduled_end_time?.slice(0, 5)}</td>
                  <td className="p-3 text-sm">{(m as any).facilitator?.full_name ?? '—'}</td>
                  <td className="p-3 text-center"><Badge className={cn('text-[10px]', STATUS_COLORS[m.status])}>{m.status.replace('_', ' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateMeetingDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}

function CreateMeetingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:30');
  const [facilitatorId, setFacilitatorId] = useState(user?.id || '');
  const [location, setLocation] = useState('');

  const { data: facilitators } = useQuery({
    queryKey: ['facilitator-users'],
    queryFn: async () => {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['super_admin', 'factory_manager']);
      if (!roleRows?.length) return [];
      const ids = [...new Set(roleRows.map((r) => r.user_id))];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids).eq('is_active', true);
      return data || [];
    },
    enabled: open,
  });

  const { data: factory } = useQuery({
    queryKey: ['factory-for-meeting'],
    queryFn: async () => {
      const { data } = await supabase.from('factory').select('id').limit(1).single();
      return data;
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!date || !factory) throw new Error('Missing required fields');
      const { error } = await supabase.from('meetings').insert({
        title,
        scheduled_date: format(date, 'yyyy-MM-dd'),
        scheduled_start_time: startTime,
        scheduled_end_time: endTime,
        facilitator_id: facilitatorId || user!.id,
        factory_id: factory.id,
        location: location || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Meeting created' });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      onOpenChange(false);
      setTitle('');
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(isMobile && 'h-full max-h-full w-full max-w-full rounded-none border-0 sm:rounded-none', 'sm:max-w-lg')}>
        <DialogHeader><DialogTitle>New Meeting</DialogTitle></DialogHeader>
        <div className="space-y-4 overflow-y-auto">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g. "T4 Daily Review"' className="h-11 mt-1" /></div>
          <div>
            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start h-11 mt-1', !date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Time *</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-11 mt-1" /></div>
            <div><Label>End Time *</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-11 mt-1" /></div>
          </div>
          <div>
            <Label>Facilitator</Label>
            <Select value={facilitatorId} onValueChange={setFacilitatorId}>
              <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select facilitator" /></SelectTrigger>
              <SelectContent>
                {facilitators?.map((f) => <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" className="h-11 mt-1" /></div>
          <Button onClick={() => createMutation.mutate()} disabled={!title || !date || createMutation.isPending} className="w-full h-12 mt-2">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Meeting
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
