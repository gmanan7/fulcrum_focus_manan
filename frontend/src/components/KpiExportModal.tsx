import { useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  buildExcelSummaryRows,
  buildDailyDataRows,
  buildMtdRows,
  generateExportFilename,
  type KpiMaster,
  type KpiEntry,
  type DepartmentRef,
} from '@/lib/kpiExport';

export interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All KPIs available for the user. */
  allKpis: KpiMaster[];
  /** Current period entries (already filtered to selected period). */
  periodEntries: KpiEntry[];
  /** All departments. */
  departments: DepartmentRef[];
  /** KPIs visible in the current view (after dept filters). */
  currentViewKpis: KpiMaster[];
  /** Current period date range, used as default for Excel "Selected period". */
  periodFrom: Date;
  periodTo: Date;
  /** User's display name for the PDF cover. */
  userName?: string;
  /** Selector for the dashboard grid container to capture in the PDF (optional). */
  dashboardSelector?: string;
  /** Selector for chart containers — defaults to [data-export-chart]. */
  chartSelector?: string;
  /** Source page label, shown on the PDF cover. */
  sourceLabel?: string;
  /** Async fetcher for entries in a custom date range (for Excel custom range option). */
  fetchEntriesForRange?: (from: Date, to: Date) => Promise<KpiEntry[]>;
}

type ContentScope = 'current' | 'all';
type DateRangeChoice = 'period' | 'this_month' | 'custom';

export function KpiExportModal({
  open,
  onOpenChange,
  allKpis,
  periodEntries,
  departments,
  currentViewKpis,
  periodFrom,
  periodTo,
  userName,
  dashboardSelector,
  chartSelector = '[data-export-chart]',
  sourceLabel = 'KPI Performance Report',
  fetchEntriesForRange,
}: ExportModalProps) {
  const { toast } = useToast();
  const [fmt, setFmt] = useState<'xlsx' | 'pdf'>('xlsx');
  const [scope, setScope] = useState<ContentScope>('current');
  const [dateRange, setDateRange] = useState<DateRangeChoice>('period');
  const [customFrom, setCustomFrom] = useState<Date | undefined>(periodFrom);
  const [customTo, setCustomTo] = useState<Date | undefined>(periodTo);
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const kpiList = scope === 'all' ? allKpis : currentViewKpis;
      const kpiIds = new Set(kpiList.map((k) => k.id));

      if (fmt === 'xlsx') {
        let from = periodFrom;
        let to = periodTo;
        let entries = periodEntries;
        if (dateRange === 'this_month') {
          const now = new Date();
          from = new Date(now.getFullYear(), now.getMonth(), 1);
          to = now;
          if (fetchEntriesForRange) entries = await fetchEntriesForRange(from, to);
        } else if (dateRange === 'custom' && customFrom && customTo) {
          from = customFrom;
          to = customTo;
          if (fetchEntriesForRange) entries = await fetchEntriesForRange(from, to);
        }
        const filteredEntries = entries.filter(
          (e) =>
            kpiIds.has(e.kpi_id) &&
            e.reporting_date >= format(from, 'yyyy-MM-dd') &&
            e.reporting_date <= format(to, 'yyyy-MM-dd'),
        );
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(buildExcelSummaryRows(kpiList, departments)),
          'Summary',
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(buildDailyDataRows(filteredEntries, kpiList, departments)),
          'Daily Data',
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(buildMtdRows(kpiList, filteredEntries, departments)),
          'MTD Summary',
        );
        XLSX.writeFile(wb, generateExportFilename('xlsx'));
      } else {
        await generatePdf({
          sourceLabel,
          userName,
          periodFrom,
          periodTo,
          dashboardSelector,
          chartSelector,
        });
      }

      toast({ title: 'Export ready', description: `${fmt.toUpperCase()} downloaded.` });
      onOpenChange(false);
    } catch (err: any) {
      console.error('[export] failed', err);
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
          <DialogTitle>Export KPI Data</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Format */}
          <div className="space-y-2">
            <Label>Format</Label>
            <RadioGroup value={fmt} onValueChange={(v) => setFmt(v as any)} className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="xlsx" id="fmt-xlsx" />
                <span className="text-sm">Excel (.xlsx)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="pdf" id="fmt-pdf" />
                <span className="text-sm">PDF</span>
              </label>
            </RadioGroup>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label>Content</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as any)} className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="current" id="scope-current" />
                <span className="text-sm">Current view ({currentViewKpis.length} KPIs)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="all" id="scope-all" />
                <span className="text-sm">All departments ({allKpis.length} KPIs)</span>
              </label>
            </RadioGroup>
          </div>

          {/* Date range — Excel only */}
          {fmt === 'xlsx' && (
            <div className="space-y-2">
              <Label>Date range</Label>
              <RadioGroup value={dateRange} onValueChange={(v) => setDateRange(v as any)} className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="period" id="dr-period" />
                  <span className="text-sm">Selected period ({format(periodFrom, 'dd MMM')} – {format(periodTo, 'dd MMM yyyy')})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="this_month" id="dr-month" />
                  <span className="text-sm">This month</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="custom" id="dr-custom" />
                  <span className="text-sm">Custom range</span>
                </label>
              </RadioGroup>
              {dateRange === 'custom' && (
                <div className="flex gap-2 pt-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {customFrom ? format(customFrom, 'dd MMM yyyy') : 'From'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {customTo ? format(customTo, 'dd MMM yyyy') : 'To'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleDownload} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── PDF generation ── */
async function generatePdf({
  sourceLabel,
  userName,
  periodFrom,
  periodTo,
  dashboardSelector,
  chartSelector,
}: {
  sourceLabel: string;
  userName?: string;
  periodFrom: Date;
  periodTo: Date;
  dashboardSelector?: string;
  chartSelector: string;
}) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // ── Cover page ──
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('ITC PPB NPF — KPI Performance Report', pageW / 2, 120, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text(`Period: ${format(periodFrom, 'dd MMM yyyy')} – ${format(periodTo, 'dd MMM yyyy')}`, pageW / 2, 170, { align: 'center' });
  pdf.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, pageW / 2, 195, { align: 'center' });
  if (userName) pdf.text(`Generated by: ${userName}`, pageW / 2, 220, { align: 'center' });
  pdf.setFontSize(10);
  pdf.setTextColor(120);
  pdf.text(sourceLabel, pageW / 2, pageH - 40, { align: 'center' });
  pdf.setTextColor(0);

  // ── Dashboard snapshot ──
  if (dashboardSelector) {
    const dash = document.querySelector(dashboardSelector) as HTMLElement | null;
    if (dash) {
      const canvas = await html2canvas(dash, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      pdf.addPage('a4', 'portrait');
      const margin = 24;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2 - 30;
      const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('KPI Performance', margin, margin + 4);
      pdf.addImage(imgData, 'PNG', margin, margin + 20, w, h);
    }
  }

  // ── Chart pages (landscape, 2 per page) ──
  const charts = Array.from(document.querySelectorAll(chartSelector)) as HTMLElement[];
  if (charts.length > 0) {
    const landW = pdf.internal.pageSize.getHeight();
    const landH = pdf.internal.pageSize.getWidth();
    for (let i = 0; i < charts.length; i += 2) {
      pdf.addPage('a4', 'landscape');
      const margin = 24;
      const colW = (landW - margin * 3) / 2;
      const slotH = landH - margin * 2;
      for (let j = 0; j < 2; j++) {
        const el = charts[i + j];
        if (!el) break;
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const ratio = Math.min(colW / canvas.width, slotH / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        const x = margin + j * (colW + margin);
        pdf.addImage(imgData, 'PNG', x, margin, w, h);
      }
    }
  }

  pdf.save(generateExportFilename('pdf'));
}
