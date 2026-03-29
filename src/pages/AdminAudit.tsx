import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronLeft, ChevronRight, Eye, Loader2, Filter } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

const ACTION_COLORS = { INSERT: 'bg-success/10 text-success', UPDATE: 'bg-primary/10 text-primary', DELETE: 'bg-destructive/10 text-destructive' };

export default function AdminAudit() {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(0);
  const [tableFilter, setTableFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [filtersOpen, setFiltersOpen] = useState(!isMobile);
  const [viewJson, setViewJson] = useState<{ old_values: any; new_values: any } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, tableFilter, actionFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('audit_logs')
        .select('*, profiles:performed_by(full_name)', { count: 'exact' })
        .order('performed_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (tableFilter !== 'all') q = q.eq('table_name', tableFilter);
      if (actionFilter !== 'all') q = q.eq('action', actionFilter as any);
      if (dateFrom) q = q.gte('performed_at', dateFrom.toISOString());
      if (dateTo) q = q.lte('performed_at', new Date(dateTo.getTime() + 86400000).toISOString());

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data || [], total: count || 0 };
    },
  });

  const tableNames = ['factory', 'department', 'profiles', 'user_roles', 'user_departments', 'kpi_master', 'kpi_entries', 'meetings', 'tasks'];
  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground md:text-2xl">Audit Log</h1>

      {/* Filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1 md:hidden"><Filter className="h-3.5 w-3.5" /> Filters</Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v); setPage(0); }}>
              <SelectTrigger className="h-10 w-full md:w-40"><SelectValue placeholder="Table" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tables</SelectItem>
                {tableNames.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger className="h-10 w-full md:w-36"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('h-10 w-full md:w-40 justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'PP') : 'From date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('h-10 w-full md:w-40 justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, 'PP') : 'To date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </CollapsibleContent>
        {/* On desktop always show filters */}
        <div className="hidden md:block">
          <div className="flex gap-3 items-end">
            <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v); setPage(0); }}>
              <SelectTrigger className="h-10 w-40"><SelectValue placeholder="Table" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tables</SelectItem>
                {tableNames.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger className="h-10 w-36"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('h-10 w-40 justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'PP') : 'From date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('h-10 w-40 justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, 'PP') : 'To date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Collapsible>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isMobile ? (
        <div className="space-y-3">
          {data?.rows.map((row: any) => (
            <Card key={row.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={`text-xs ${ACTION_COLORS[row.action as keyof typeof ACTION_COLORS]}`}>{row.action}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(row.performed_at), 'PP p')}</span>
                </div>
                <p className="text-sm font-medium">{row.table_name}</p>
                <p className="text-xs text-muted-foreground">{row.profiles?.full_name || 'System'}</p>
                <Button variant="outline" size="sm" className="w-full h-9 gap-1" onClick={() => setViewJson({ old_values: row.old_values, new_values: row.new_values })}>
                  <Eye className="h-3 w-3" /> View Changes
                </Button>
              </CardContent>
            </Card>
          ))}
          {data?.rows.length === 0 && <p className="text-center py-8 text-muted-foreground">No audit logs found</p>}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.rows.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm">{format(new Date(row.performed_at), 'PP p')}</TableCell>
                  <TableCell className="font-mono text-sm">{row.table_name}</TableCell>
                  <TableCell><Badge className={`text-xs ${ACTION_COLORS[row.action as keyof typeof ACTION_COLORS]}`}>{row.action}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.profiles?.full_name || 'System'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setViewJson({ old_values: row.old_values, new_values: row.new_values })}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data?.rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No audit logs found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* JSON Viewer Dialog */}
      <Dialog open={!!viewJson} onOpenChange={() => setViewJson(null)}>
        <DialogContent className={isMobile ? 'h-full max-h-full w-full max-w-full rounded-none' : 'max-w-2xl'}>
          <DialogHeader><DialogTitle>Change Details</DialogTitle></DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[calc(100dvh-8rem)] md:max-h-[60vh]">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Old Values</p>
              <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {viewJson?.old_values ? JSON.stringify(viewJson.old_values, null, 2) : 'null'}
              </pre>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">New Values</p>
              <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {viewJson?.new_values ? JSON.stringify(viewJson.new_values, null, 2) : 'null'}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
