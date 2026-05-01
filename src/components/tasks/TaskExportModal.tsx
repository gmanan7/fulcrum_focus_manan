import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  buildTaskExportRow,
  sortTasksForExport,
  generateTaskFilename,
  type TaskExportInput,
} from '@/lib/taskExport';

export interface TaskExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tasks visible after current chip + dropdown filters. */
  currentViewTasks: TaskExportInput[];
  /** All tasks unfiltered. */
  allTasks: TaskExportInput[];
  pushCounts?: Map<string, number>;
  groupNameById?: Map<string, string>;
  userNameById?: Map<string, string>;
}

type Scope = 'current' | 'all';

export function TaskExportModal({
  open,
  onOpenChange,
  currentViewTasks,
  allTasks,
  pushCounts,
  groupNameById,
  userNameById,
}: TaskExportModalProps) {
  const { toast } = useToast();
  const [scope, setScope] = useState<Scope>('current');
  const [busy, setBusy] = useState(false);

  const handleDownload = () => {
    setBusy(true);
    try {
      const source = scope === 'current' ? currentViewTasks : allTasks;
      const sorted = sortTasksForExport(source);
      const rows = sorted.map((t) =>
        buildTaskExportRow(t, { pushCounts, groupNameById, userNameById }),
      );
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
      XLSX.writeFile(wb, generateTaskFilename());
      toast({ title: 'Export ready', description: `${rows.length} tasks exported.` });
      onOpenChange(false);
    } catch (err: any) {
      console.error('[task-export] failed', err);
      toast({
        title: 'Export failed',
        description: err?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Tasks</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>Scope</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="current" id="task-scope-current" />
                <span className="text-sm">Current view ({currentViewTasks.length} tasks)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="all" id="task-scope-all" />
                <span className="text-sm">All tasks ({allTasks.length} tasks)</span>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-1">
            <Label>Format</Label>
            <p className="text-sm text-muted-foreground">Excel (.xlsx)</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
