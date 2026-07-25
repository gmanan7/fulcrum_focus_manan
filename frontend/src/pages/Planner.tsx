import { useState, useMemo, useRef, useEffect } from 'react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { Lock, Plus, CalendarCheck, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePlannerItems, type PlannerItem } from '@/hooks/usePlannerItems';
import { PlannerItemCard } from '@/components/planner/PlannerItemCard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type View = 'today' | 'upcoming' | 'all' | 'completed';

export default function Planner() {
  const isMobile = useIsMobile();
  const { items, isLoading, addItem, updateItem, deleteItem, completeItem, uncompleteItem, deleteCompleted } = usePlannerItems();
  const [view, setView] = useState<View>('today');
  const [quickText, setQuickText] = useState('');
  const [fabOpen, setFabOpen] = useState(false);
  const [fabTitle, setFabTitle] = useState('');
  const [fabNotes, setFabNotes] = useState('');
  const [fabDate, setFabDate] = useState<Date>(new Date());
  const [fabRecurrence, setFabRecurrence] = useState('none');
  const [undoItem, setUndoItem] = useState<PlannerItem | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();
  const [clearingCompleted, setClearingCompleted] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = format(today, 'yyyy-MM-dd');

  const handleQuickAdd = () => {
    const text = quickText.trim();
    if (!text) return;
    addItem.mutate({
      title: text,
      due_date: view === 'today' ? todayStr : undefined,
    });
    setQuickText('');
  };

  const handleFabAdd = () => {
    if (!fabTitle.trim()) return;
    addItem.mutate({
      title: fabTitle.trim(),
      notes: fabNotes.trim() || null,
      due_date: format(fabDate, 'yyyy-MM-dd'),
      recurrence_type: fabRecurrence as any,
    });
    setFabTitle(''); setFabNotes(''); setFabDate(new Date()); setFabRecurrence('none');
    setFabOpen(false);
  };

  const handleComplete = (item: PlannerItem) => {
    setUndoItem(item);
    completeItem.mutate(item);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoItem(null), 5000);
  };

  const handleUndo = () => {
    if (!undoItem) return;
    uncompleteItem.mutate(undoItem.id);
    setUndoItem(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  };

  const handleUpdate = (updates: Partial<PlannerItem> & { id: string }) => {
    updateItem.mutate(updates);
  };

  const handleDelete = (id: string) => {
    deleteItem.mutate(id);
  };

  const handleClearCompleted = () => {
    setClearingCompleted(false);
    deleteCompleted.mutate();
  };

  // Filter items by view
  const { overdueItems, todayItems, upcomingGroups, allItems, completedItems, somedayItems } = useMemo(() => {
    const incomplete = items.filter(i => !i.is_completed);
    const completed = items.filter(i => i.is_completed);

    const overdue = incomplete.filter(i => i.due_date && parseISO(i.due_date) < today);
    const dueToday = incomplete.filter(i => i.due_date === todayStr);
    
    // Upcoming: tomorrow to +7 days
    const upcoming: Record<string, PlannerItem[]> = {};
    const someday: PlannerItem[] = [];
    for (let d = 1; d <= 7; d++) {
      const dateStr = format(addDays(today, d), 'yyyy-MM-dd');
      const matching = incomplete.filter(i => i.due_date === dateStr);
      if (matching.length) upcoming[dateStr] = matching;
    }
    incomplete.filter(i => !i.due_date).forEach(i => someday.push(i));

    // All: sorted
    const all = [...incomplete].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

    // Completed: last 14 days
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const recentCompleted = completed
      .filter(i => i.completed_at && new Date(i.completed_at) >= twoWeeksAgo)
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

    return {
      overdueItems: overdue,
      todayItems: dueToday,
      upcomingGroups: upcoming,
      allItems: all,
      completedItems: recentCompleted,
      somedayItems: someday,
    };
  }, [items, todayStr]);

  const views: { key: View; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'all', label: 'All' },
    { key: 'completed', label: 'Completed' },
  ];

  const renderEmpty = (msg: string, sub?: string) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CalendarCheck className="h-10 w-10 mb-3" style={{ color: 'var(--text-muted)' }} />
      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{msg}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );

  const renderItemList = (itemsList: PlannerItem[], completed = false) => (
    <div className="space-y-3">
      {itemsList.map(item => (
        <PlannerItemCard
          key={item.id}
          item={item}
          onComplete={handleComplete}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          isCompleted={completed}
        />
      ))}
    </div>
  );

  const sectionLabel = (text: string, color?: string) => (
    <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 mt-4 first:mt-0"
       style={{ color: color || 'var(--text-secondary)' }}>
      {text}
    </p>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>My Planner</h1>
        <p className="text-xs flex items-center gap-1 mt-1" style={{ color: 'var(--text-muted)' }}>
          <Lock className="h-3 w-3" /> Private · Only visible to you
        </p>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-hide">
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              view === v.key ? 'text-white' : ''
            )}
            style={{
              background: view === v.key ? 'hsl(var(--primary))' : 'transparent',
              color: view === v.key ? 'white' : 'var(--text-secondary)',
            }}
          >
            {v.label}
            {v.key === 'today' && (overdueItems.length + todayItems.length > 0) && (
              <span className="ml-1.5 text-xs opacity-80">({overdueItems.length + todayItems.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Quick add bar */}
      <div className="flex gap-2 mb-5">
        <Input
          value={quickText}
          onChange={(e) => setQuickText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
          placeholder="What needs to get done? Press Enter to add"
          className="flex-1"
        />
        <Button onClick={handleQuickAdd} size="icon" disabled={!quickText.trim()}
          style={{ background: 'hsl(var(--primary))' }} className="text-white shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : (
        <>
          {view === 'today' && (
            <>
              {overdueItems.length === 0 && todayItems.length === 0
                ? renderEmpty("You're all clear for today", "Add something above or check Upcoming")
                : (
                  <>
                    {overdueItems.length > 0 && (
                      <>
                        {sectionLabel('Overdue', 'hsl(var(--destructive))')}
                        {renderItemList(overdueItems)}
                      </>
                    )}
                    {todayItems.length > 0 && (
                      <>
                        {sectionLabel('Today')}
                        {renderItemList(todayItems)}
                      </>
                    )}
                  </>
                )}
            </>
          )}

          {view === 'upcoming' && (
            <>
              {Object.keys(upcomingGroups).length === 0 && somedayItems.length === 0
                ? renderEmpty("Nothing upcoming", "Your next 7 days are clear")
                : (
                  <>
                    {Object.entries(upcomingGroups).map(([dateStr, groupItems]) => {
                      const d = parseISO(dateStr);
                      const diffD = differenceInDays(d, today);
                      const label = diffD === 1
                        ? `Tomorrow — ${format(d, 'EEE d MMM')}`
                        : format(d, 'EEE d MMM');
                      return (
                        <div key={dateStr}>
                          {sectionLabel(label)}
                          {renderItemList(groupItems)}
                        </div>
                      );
                    })}
                    {somedayItems.length > 0 && (
                      <>
                        {sectionLabel('Someday')}
                        {renderItemList(somedayItems)}
                      </>
                    )}
                  </>
                )}
            </>
          )}

          {view === 'all' && (
            allItems.length === 0
              ? renderEmpty("No items yet", "Add your first item above")
              : renderItemList(allItems)
          )}

          {view === 'completed' && (
            <>
              {completedItems.length > 0 && (
                <div className="flex justify-end mb-3">
                  {!clearingCompleted ? (
                    <button onClick={() => setClearingCompleted(true)} className="text-xs font-medium" style={{ color: 'hsl(var(--destructive))' }}>
                      Clear all
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <span style={{ color: 'var(--text-secondary)' }}>Delete all completed items?</span>
                      <button onClick={handleClearCompleted} className="font-medium" style={{ color: 'hsl(var(--destructive))' }}>Yes</button>
                      <button onClick={() => setClearingCompleted(false)} style={{ color: 'var(--text-muted)' }}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
              {completedItems.length === 0
                ? renderEmpty("No completed items", "Items completed in the last 14 days show here")
                : renderItemList(completedItems, true)
              }
            </>
          )}
        </>
      )}

      {/* Undo snackbar */}
      {undoItem && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}>
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Marked as done</span>
          <button onClick={handleUndo} className="text-sm font-semibold" style={{ color: 'hsl(var(--primary))' }}>
            Undo
          </button>
        </div>
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <button
          onClick={() => setFabOpen(true)}
          className="fixed z-40 flex items-center justify-center rounded-full shadow-lg text-white"
          style={{ background: 'hsl(var(--primary))', width: 56, height: 56, bottom: 76, right: 20 }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* FAB bottom sheet */}
      <Sheet open={fabOpen} onOpenChange={setFabOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Add to Planner</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <Input
              value={fabTitle}
              onChange={(e) => setFabTitle(e.target.value)}
              placeholder="What needs to get done?"
              autoFocus
            />
            <Textarea
              value={fabNotes}
              onChange={(e) => setFabNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left">
                  {format(fabDate, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={fabDate} onSelect={(d) => d && setFabDate(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Select value={fabRecurrence} onValueChange={setFabRecurrence}>
              <SelectTrigger><SelectValue placeholder="Recurrence" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleFabAdd} disabled={!fabTitle.trim()} className="w-full" style={{ background: 'hsl(var(--primary))' }}>
              Add to Planner
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
