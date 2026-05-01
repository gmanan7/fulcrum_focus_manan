import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getMeetingKpiReportingDate } from '@/lib/utils';
import { getMtdDateRange, calculateMtd } from '@/lib/mtdUtils';
import { fetchAllKpiEntries } from '@/lib/kpiEntriesApi';
import {
  MEETING_EXPORT_SECTIONS,
  defaultSectionSelections,
  chosenFormats,
  buildAttendanceRows,
  buildKpiRows,
  buildTaskRows,
  formatDuration,
  generateMeetingFilename,
  type SectionFormat,
  type SectionSelection,
  type KpiSnapshotInput,
} from '@/lib/meetingExport';

export interface MeetingExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: any;
}

export function MeetingExportModal({ open, onOpenChange, meeting }: MeetingExportModalProps) {
  const { toast } = useToast();
  const [selections, setSelections] = useState<SectionSelection[]>(defaultSectionSelections());
  const [busy, setBusy] = useState(false);

  const setSelected = (key: string, selected: boolean) =>
    setSelections((prev) => prev.map((s) => (s.key === key ? { ...s, selected } : s)));
  const setFormat = (key: string, fmt: SectionFormat) =>
    setSelections((prev) => prev.map((s) => (s.key === key ? { ...s, format: fmt } : s)));

  const { pdf: pdfSections, xlsx: xlsxSections } = useMemo(
    () => chosenFormats(selections),
    [selections],
  );
  const bothFormats = pdfSections.length > 0 && xlsxSections.length > 0;
  const noneSelected = pdfSections.length === 0 && xlsxSections.length === 0;

  /* ── Data needed for export (only fetched when modal open) ── */
  const needAttendance = selections.some((s) => s.selected && s.key === 'attendance');
  const needKpi = selections.some((s) => s.selected && s.key === 'kpi');
  const needNotes = selections.some((s) => s.selected && s.key === 'notes');
  const needDecisions = selections.some((s) => s.selected && s.key === 'decisions');
  const needTasks = selections.some((s) => s.selected && s.key === 'tasks');

  const { data: facilitator } = useQuery({
    queryKey: ['meeting-export-facilitator', meeting?.facilitator_id],
    queryFn: async () => {
      if (!meeting?.facilitator_id) return null;
      const { data } = await supabase.from('profiles').select('full_name').eq('id', meeting.facilitator_id).maybeSingle();
      return data;
    },
    enabled: !!open && !!meeting?.facilitator_id,
  });

  const { data: attendance } = useQuery({
    queryKey: ['meeting-export-attendance', meeting?.id],
    queryFn: async () => {
      const [{ data: invitees }, { data: rows }] = await Promise.all([
        supabase
          .from('meeting_invitees')
          .select('id, role, is_mandatory, user:profiles!meeting_invitees_user_id_fkey(full_name), dept:department!meeting_invitees_department_id_fkey(name)')
          .eq('meeting_id', meeting.id),
        supabase.from('meeting_attendance').select('invitee_id, status').eq('meeting_id', meeting.id),
      ]);
      const inviteeMap = new Map((invitees || []).map((i: any) => [i.id, i]));
      return (invitees || []).map((inv: any) => {
        const att = (rows || []).find((r: any) => r.invitee_id === inv.id);
        return { invitee_id: inv.id, status: att?.status ?? null, invitee: inviteeMap.get(inv.id) };
      });
    },
    enabled: !!open && !!meeting?.id && needAttendance,
  });

  const { data: kpiSnapshot } = useQuery({
    queryKey: ['meeting-export-kpi', meeting?.id],
    queryFn: async () => {
      const kpiDate = getMeetingKpiReportingDate(meeting.scheduled_date);
      const range = getMtdDateRange(kpiDate);
      const [{ data: kpis }, { data: yEntries }, mtdEntries, { data: depts }] = await Promise.all([
        supabase.from('kpi_master').select('*').eq('is_active', true).in('kpi_type', ['numeric', 'descriptive']).order('display_order'),
        supabase.from('kpi_entries').select('*').eq('reporting_date', kpiDate),
        fetchAllKpiEntries(range.from, range.to, 'kpi_id, actual_value, reporting_date'),
        supabase.from('department').select('id, name'),
      ]);
      const deptMap = new Map((depts || []).map((d: any) => [d.id, d.name]));
      const yMap = new Map((yEntries || []).map((e: any) => [e.kpi_id, e]));
      const mtdMap = new Map<string, any[]>();
      (mtdEntries || []).forEach((e: any) => {
        if (!mtdMap.has(e.kpi_id)) mtdMap.set(e.kpi_id, []);
        mtdMap.get(e.kpi_id)!.push(e);
      });
      return (kpis || []).map((k: any): KpiSnapshotInput => {
        const y = yMap.get(k.id);
        const mtd = calculateMtd(mtdMap.get(k.id) || [], k.mtd_aggregation);
        const status = y?.computed_status ?? null;
        return {
          id: k.id,
          name: k.name,
          unit: k.unit,
          target_value: k.target_value,
          department: { name: deptMap.get(k.department_id) ?? '' },
          yesterday_value: y?.actual_value ?? null,
          mtd_value: mtd,
          status,
        };
      });
    },
    enabled: !!open && !!meeting?.id && needKpi,
  });

  const { data: notesData } = useQuery({
    queryKey: ['meeting-export-notes', meeting?.id],
    queryFn: async () => {
      const { data: points } = await supabase
        .from('meeting_discussion_points')
        .select('title, notes, sequence')
        .eq('meeting_id', meeting.id)
        .order('sequence');
      return { summary: meeting.summary || '', points: points || [] };
    },
    enabled: !!open && !!meeting?.id && needNotes,
  });

  const { data: decisions } = useQuery({
    queryKey: ['meeting-export-decisions', meeting?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('meeting_decisions')
        .select('decision_text, created_at')
        .eq('meeting_id', meeting.id)
        .order('created_at');
      return data || [];
    },
    enabled: !!open && !!meeting?.id && needDecisions,
  });

  const { data: tasks } = useQuery({
    queryKey: ['meeting-export-tasks', meeting?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date, owner:profiles!tasks_owner_id_fkey(full_name), creator:profiles!tasks_assigned_by_fkey(full_name)')
        .eq('origin_meeting_id', meeting.id);
      return data || [];
    },
    enabled: !!open && !!meeting?.id && needTasks,
  });

  /* ── Generation ── */
  const handleExport = async () => {
    if (noneSelected) return;
    setBusy(true);
    try {
      // PDF
      if (pdfSections.length > 0) {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        let y = 100;

        // Cover
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(22);
        pdf.text('Meeting Minutes', pageW / 2, y, { align: 'center' });
        y += 40;
        pdf.setFontSize(16);
        pdf.text(meeting.title, pageW / 2, y, { align: 'center', maxWidth: pageW - 80 });
        y += 40;
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11);
        const dateLine = `Date: ${format(new Date(meeting.scheduled_date), 'dd MMM yyyy')}`;
        const timeLine = meeting.scheduled_start_time && meeting.scheduled_end_time
          ? ` | Time: ${meeting.scheduled_start_time.slice(0, 5)} – ${meeting.scheduled_end_time.slice(0, 5)}`
          : '';
        const dur = formatDuration(meeting.actual_start, meeting.actual_end);
        const durLine = dur ? ` | Duration: ${dur}` : '';
        pdf.text(dateLine + timeLine + durLine, pageW / 2, y, { align: 'center' });
        y += 24;
        if (facilitator?.full_name) {
          pdf.text(`Facilitated by: ${facilitator.full_name}`, pageW / 2, y, { align: 'center' });
          y += 20;
        }
        pdf.text(`Auto-closed: ${meeting.auto_closed ? 'Yes' : 'No'}`, pageW / 2, y, { align: 'center' });

        const margin = 48;
        const writeHeading = (text: string) => {
          if (y > pageH - 80) { pdf.addPage(); y = margin; }
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
          pdf.text(text, margin, y);
          y += 22;
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11);
        };
        const writeLine = (text: string) => {
          const lines = pdf.splitTextToSize(text, pageW - margin * 2);
          for (const line of lines) {
            if (y > pageH - 60) { pdf.addPage(); y = margin; }
            pdf.text(line, margin, y);
            y += 16;
          }
        };

        // Sections, in order
        if (pdfSections.includes('summary')) {
          pdf.addPage(); y = margin;
          writeHeading('Meeting Summary');
          writeLine(`Status: ${meeting.status}`);
          if (attendance) {
            const present = attendance.filter((a: any) => a.status === 'present').length;
            writeLine(`Attendance: ${present} present / ${attendance.length} invited`);
          }
          if (tasks) writeLine(`Tasks created: ${tasks.length}`);
          if (decisions) writeLine(`Decisions recorded: ${decisions.length}`);
        }
        if (pdfSections.includes('attendance') && attendance) {
          pdf.addPage(); y = margin;
          writeHeading('Attendance');
          const rows = buildAttendanceRows(attendance);
          rows.forEach((r) => writeLine(`• ${r.Name} — ${r.Department} — ${r.Role} — ${r.Status}`));
        }
        if (pdfSections.includes('notes') && notesData) {
          pdf.addPage(); y = margin;
          writeHeading('Notes & Discussion');
          if (notesData.summary) {
            notesData.summary.split(/\r?\n/).forEach((line) => writeLine(line || ' '));
            y += 8;
          }
          notesData.points.forEach((p: any, idx: number) => {
            pdf.setFont('helvetica', 'bold');
            writeLine(`${idx + 1}. ${p.title}`);
            pdf.setFont('helvetica', 'normal');
            if (p.notes) p.notes.split(/\r?\n/).forEach((line: string) => writeLine(line || ' '));
            y += 4;
          });
        }
        if (pdfSections.includes('decisions') && decisions) {
          pdf.addPage(); y = margin;
          writeHeading('Decisions');
          if (decisions.length === 0) writeLine('No decisions recorded.');
          decisions.forEach((d: any, idx: number) => writeLine(`${idx + 1}. ${d.decision_text}`));
        }
        if (pdfSections.includes('tasks') && tasks) {
          pdf.addPage(); y = margin;
          writeHeading('Tasks Created');
          const rows = buildTaskRows(tasks as any);
          rows.forEach((r) => writeLine(`• ${r['Task Title']} — ${r['Assigned To']} — Due ${r['Due Date'] || '—'} — ${r.Status} (${r.Priority})`));
        }
        if (pdfSections.includes('kpi') && kpiSnapshot) {
          pdf.addPage(); y = margin;
          writeHeading('KPI Snapshot');
          const rows = buildKpiRows(kpiSnapshot);
          rows.forEach((r) => writeLine(`• ${r.Department} — ${r['KPI Name']} — Target ${r.Target} — Y ${r['Yesterday Value']} — MTD ${r['MTD Value']} — ${r.Status}`));
        }

        pdf.save(generateMeetingFilename(meeting.scheduled_date, meeting.title, 'pdf'));
      }

      // Excel
      if (xlsxSections.length > 0) {
        const wb = XLSX.utils.book_new();
        if (xlsxSections.includes('kpi') && kpiSnapshot) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildKpiRows(kpiSnapshot)), 'KPI Snapshot');
        }
        if (xlsxSections.includes('tasks') && tasks) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildTaskRows(tasks as any)), 'Tasks Created');
        }
        if (xlsxSections.includes('attendance') && attendance) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buildAttendanceRows(attendance)), 'Attendance');
        }
        if (xlsxSections.includes('decisions') && decisions) {
          const rows = decisions.map((d: any, idx: number) => ({
            '#': idx + 1,
            Decision: d.decision_text,
            'Recorded At': d.created_at ? format(new Date(d.created_at), 'dd/MM/yyyy HH:mm') : '',
          }));
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Decisions');
        }
        // safety: ensure sheet exists
        if (wb.SheetNames.length > 0) {
          XLSX.writeFile(wb, generateMeetingFilename(meeting.scheduled_date, meeting.title, 'xlsx'));
        }
      }

      toast({ title: 'Export ready', description: bothFormats ? 'PDF and Excel downloaded.' : 'File downloaded.' });
      onOpenChange(false);
    } catch (err: any) {
      console.error('[meeting-export] failed', err);
      toast({ title: 'Export failed', description: err?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Meeting</DialogTitle>
          {meeting && (
            <DialogDescription>
              {meeting.title} · {format(new Date(meeting.scheduled_date), 'dd MMM yyyy')}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-2 py-2">
          {MEETING_EXPORT_SECTIONS.map((cfg) => {
            const sel = selections.find((s) => s.key === cfg.key)!;
            return (
              <div key={cfg.key} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0">
                <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                  <Checkbox
                    checked={sel.selected}
                    onCheckedChange={(v) => setSelected(cfg.key, v === true)}
                  />
                  <span className="text-sm truncate">{cfg.label}</span>
                </label>
                <RadioGroup
                  value={sel.format}
                  onValueChange={(v) => setFormat(cfg.key, v as SectionFormat)}
                  className="flex gap-3 shrink-0"
                  disabled={!sel.selected}
                >
                  {cfg.allowedFormats.includes('pdf') && (
                    <label className={`flex items-center gap-1 text-xs cursor-pointer ${!sel.selected ? 'opacity-50' : ''}`}>
                      <RadioGroupItem value="pdf" id={`${cfg.key}-pdf`} disabled={!sel.selected} />
                      PDF
                    </label>
                  )}
                  {cfg.allowedFormats.includes('xlsx') && (
                    <label className={`flex items-center gap-1 text-xs cursor-pointer ${!sel.selected ? 'opacity-50' : ''}`}>
                      <RadioGroupItem value="xlsx" id={`${cfg.key}-xlsx`} disabled={!sel.selected} />
                      Excel
                    </label>
                  )}
                </RadioGroup>
              </div>
            );
          })}

          <p className="text-xs text-muted-foreground pt-2">
            PDF and Excel files will download separately if both formats are selected.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleExport} disabled={busy || noneSelected}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
