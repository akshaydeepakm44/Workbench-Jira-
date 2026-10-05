import React, { useEffect, useState } from 'react';
import {
  CalendarEventDto,
  CalendarEventType,
} from '@workdesk/shared';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const CalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEventDto[] | null>(null);

  // Calculate start and end of current month view
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Extend to cover whole grid weeks
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Sunday start

  const endDate = new Date(lastDayOfMonth);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // Saturday end

  const fetchCalendarEvents = async () => {
    try {
      setLoading(true);
      const startStr = startDate.toISOString();
      const endStr = endDate.toISOString();

      const res = await fetch(
        `/api/v1/calendar/events?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`,
        { credentials: 'include' },
      );

      if (res.ok) {
        setEvents(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarEvents();
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate grid days
  const gridDays: Date[] = [];
  const curr = new Date(startDate);
  while (curr <= endDate) {
    gridDays.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  const getEventsForDay = (day: Date) => {
    const dayStr = day.toISOString().split('T')[0];
    return events.filter((e) => {
      if (filterType !== 'ALL' && e.sourceType !== filterType) return false;
      const eventStartStr = e.startDate.split('T')[0];
      const eventEndStr = e.endDate.split('T')[0];
      return dayStr >= eventStartStr && dayStr <= eventEndStr;
    });
  };

  const getPillStyle = (type: CalendarEventType) => {
    switch (type) {
      case 'TASK_DEADLINE':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'SPRINT':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'MEETING':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'STANDUP':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'MILESTONE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-indigo-400" />
            <span>Unified Work Calendar</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Consolidated timeline of task deadlines, sprint boundaries, scheduled meetings, and standups.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {loading && (
            <span className="text-xs text-indigo-400 font-mono animate-pulse">Syncing...</span>
          )}
          {/* Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent focus:outline-none text-slate-300 font-medium"
            >
              <option value="ALL">All Event Types</option>
              <option value="TASK_DEADLINE">Task Deadlines</option>
              <option value="SPRINT">Sprint Cycles</option>
              <option value="MEETING">Meetings</option>
              <option value="STANDUP">Stand-ups</option>
              <option value="MILESTONE">Milestones</option>
            </select>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-white min-w-32 text-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        {/* Days of Week */}
        <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/60 text-center py-2.5 text-xs font-bold text-slate-400">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Date Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/60">
          {gridDays.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === month;
            const isToday =
              day.toDateString() === new Date().toDateString();
            const dayEvents = getEventsForDay(day);

            return (
              <div
                key={idx}
                onClick={() => setSelectedDayEvents(dayEvents.length > 0 ? dayEvents : null)}
                className={`min-h-28 p-2 flex flex-col justify-between transition-colors cursor-pointer hover:bg-slate-800/30 ${
                  !isCurrentMonth ? 'opacity-40 bg-slate-950/20' : ''
                } ${isToday ? 'bg-indigo-500/5' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center ${
                      isToday
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-slate-500 font-medium">
                      {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                    </span>
                  )}
                </div>

                {/* Event Pills (up to 3) */}
                <div className="space-y-1 mt-1.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className={`px-1.5 py-0.5 rounded text-[10px] truncate border font-medium ${getPillStyle(
                        e.sourceType,
                      )}`}
                      title={e.title}
                    >
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-slate-500 font-semibold pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Events Drawer / Modal */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-400" />
                <span>Events for Day</span>
              </h3>
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto pr-1">
              {selectedDayEvents.map((e) => (
                <div key={e.id} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPillStyle(e.sourceType)}`}>
                      {e.sourceType.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(e.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white">{e.title}</h4>
                  <Link
                    to={e.linkUrl}
                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    <span>View record</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
