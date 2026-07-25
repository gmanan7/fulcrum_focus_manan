import { useState, useRef, useEffect, useCallback } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ChevronDown, Trash2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PlannerItem } from '@/hooks/usePlannerItems';

interface Props {
  item: PlannerItem;
  onComplete: (item: PlannerItem) => void;
  onUpdate: (updates: Partial<PlannerItem> & { id: string }) => void;
  onDelete: (id: string) => void;
  isCompleted?: boolean;
}

export function PlannerItemCard({ item, onComplete, onUpdate, onDelete, isCompleted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [checked, setChecked] = useState(item.is_completed);
  const [confirming, setConfirming] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editNotes, setEditNotes] = useState(item.notes ?? '');
  const [saved, setSaved] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showSwipeDelete, setShowSwipeDelete] = useState(false);

  useEffect(() => { setEditTitle(item.title); setEditNotes(item.notes ?? ''); }, [item.title, item.notes]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDateObj = item.due_date ? parseISO(item.due_date) : null;
  const overdueDays = dueDateObj ? differenceInDays(today, dueDateObj) : 0;
  const isDueToday = overdueDays === 0 && dueDateObj;
  const isOverdue = overdueDays > 0 && !item.is_completed;

  const completedDaysAgo = item.completed_at
    ? differenceInDays(today, new Date(item.completed_at))
    : null;

  const autoSave = useCallback((field: string, value: any) => {
    onUpdate({ id: item.id, [field]: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [item.id, onUpdate]);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleted) return;
    setChecked(true);
    onComplete(item);
  };

  const dueDateLabel = () => {
    if (!dueDateObj) return null;
    if (isOverdue) return <span className="text-xs" style={{ color: 'hsl(var(--destructive))' }}>Due {overdueDays} day{overdueDays !== 1 ? 's' : ''} ago</span>;
    if (isDueToday) return <span className="text-xs text-amber-600">Due today</span>;
    return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Due {format(dueDateObj, 'dd MMM')}</span>;
  };

  const recurrenceLabel = item.recurrence_type && item.recurrence_type !== 'none'
    ? `↻ ${item.recurrence_type.charAt(0).toUpperCase() + item.recurrence_type.slice(1)}`
    : null;

  // Touch handling for swipe
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - touchStartX.current;
    if (diff < -20) { setSwipeOffset(Math.max(diff, -80)); setShowSwipeDelete(diff < -50); }
    else if (diff > 20 && !isCompleted) { setSwipeOffset(Math.min(diff, 80)); }
    else { setSwipeOffset(0); }
  };
  const handleTouchEnd = () => {
    if (swipeOffset > 50 && !isCompleted) { setChecked(true); onComplete(item); }
    else if (swipeOffset < -50) { setShowSwipeDelete(true); setTimeout(() => { if (showSwipeDelete) { setShowSwipeDelete(false); setSwipeOffset(0); } }, 3000); return; }
    setSwipeOffset(0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe delete background */}
      {showSwipeDelete && (
        <button
          onClick={() => { onDelete(item.id); setShowSwipeDelete(false); setSwipeOffset(0); }}
          className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-rose-500 text-white rounded-r-xl z-0"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      )}

      <div
        className={cn(
          'relative z-10 border rounded-xl transition-all duration-200',
          isOverdue && !isCompleted ? 'border-l-4' : '',
          checked && !isCompleted ? 'opacity-60' : '',
        )}
        style={{
          background: isOverdue && !isCompleted ? 'hsl(var(--destructive) / 0.04)' : 'var(--bg-card)',
          borderColor: isOverdue && !isCompleted ? 'hsl(var(--destructive) / 0.3)' : 'var(--border-card)',
          borderLeftColor: isOverdue && !isCompleted ? 'hsl(var(--destructive))' : undefined,
          boxShadow: 'var(--shadow-card)',
          transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
          padding: '1rem',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={handleCheckboxClick}
            className={cn(
              'flex-shrink-0 flex items-center justify-center rounded-full border-2 transition-all duration-200 mt-0.5',
              checked || isCompleted
                ? 'border-transparent scale-100'
                : 'border-slate-300 hover:border-primary'
            )}
            style={{
              width: 36, height: 36, minWidth: 36,
              background: checked || isCompleted ? 'hsl(var(--primary))' : 'transparent',
            }}
          >
            {(checked || isCompleted) && <Check className="h-4 w-4 text-white" />}
          </button>

          {/* Content */}
          <button
            className="flex-1 text-left min-w-0"
            onClick={() => !isCompleted && setExpanded(!expanded)}
          >
            <p className={cn(
              'text-sm font-medium',
              (checked || isCompleted) ? 'line-through' : '',
            )} style={{ color: 'var(--text-primary)' }}>
              {item.title}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {dueDateLabel()}
              {item.notes && !expanded && (
                <span className="text-xs truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                  {item.notes.split('\n')[0]}
                </span>
              )}
              {recurrenceLabel && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-indigo-100 text-indigo-600 border-0">
                  {recurrenceLabel}
                </Badge>
              )}
              {isCompleted && completedDaysAgo !== null && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {completedDaysAgo === 0 ? 'Completed today' : `Completed ${completedDaysAgo} day${completedDaysAgo !== 1 ? 's' : ''} ago`}
                </span>
              )}
            </div>
          </button>

          {/* Chevron */}
          {!isCompleted && (
            <ChevronDown
              className={cn('h-4 w-4 mt-2 transition-transform flex-shrink-0', expanded && 'rotate-180')}
              style={{ color: 'var(--text-muted)' }}
            />
          )}
        </div>

        {/* Expanded edit area */}
        {expanded && !isCompleted && (
          <div className="mt-4 space-y-3 animate-fade-in">
            <Input
              ref={titleRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => editTitle !== item.title && autoSave('title', editTitle)}
              className="border-0 border-b rounded-none px-0 font-medium focus-visible:ring-0"
              style={{ color: 'var(--text-primary)' }}
            />
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              onBlur={() => editNotes !== (item.notes ?? '') && autoSave('notes', editNotes || null)}
              placeholder="Add notes..."
              rows={2}
              className="resize-none text-sm"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-xs font-medium" style={{ color: 'hsl(var(--primary))' }}>
                    {item.due_date ? `Due ${format(parseISO(item.due_date), 'dd MMM yyyy')}` : 'Set due date'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={item.due_date ? parseISO(item.due_date) : undefined}
                    onSelect={(d) => d && autoSave('due_date', format(d, 'yyyy-MM-dd'))}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {item.due_date && (
                <button onClick={() => autoSave('due_date', null)} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Clear date
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Repeat:</span>
              <Select
                value={item.recurrence_type ?? 'none'}
                onValueChange={(v) => autoSave('recurrence_type', v)}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              {item.recurrence_type === 'weekly' && (
                <Select
                  value={String(item.recurrence_day_of_week ?? 1)}
                  onValueChange={(v) => autoSave('recurrence_day_of_week', parseInt(v))}
                >
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {item.recurrence_type === 'monthly' && (
                <Input
                  type="number" min={1} max={31}
                  value={item.recurrence_day_of_month ?? 1}
                  onChange={(e) => autoSave('recurrence_day_of_month', parseInt(e.target.value) || 1)}
                  className="h-8 w-16 text-xs"
                />
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              {!confirming ? (
                <button onClick={() => setConfirming(true)} className="text-xs font-medium" style={{ color: 'hsl(var(--destructive))' }}>
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span style={{ color: 'var(--text-secondary)' }}>Delete this item?</span>
                  <button onClick={() => { onDelete(item.id); setConfirming(false); }} className="font-medium" style={{ color: 'hsl(var(--destructive))' }}>Yes, delete</button>
                  <button onClick={() => setConfirming(false)} style={{ color: 'var(--text-muted)' }}>Cancel</button>
                </div>
              )}
              {saved && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Saved</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
