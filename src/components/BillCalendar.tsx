import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertCircle, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RecurringTransaction, Account } from '../lib/db';

interface BillCalendarProps {
  recurring: RecurringTransaction[];
  accounts: Account[];
  accountBalances: Record<number, number>;
  compact?: boolean;
}

export default function BillCalendar({ recurring, accounts, accountBalances, compact = false }: BillCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const monthName = currentDate.toLocaleString('default', { month: 'short' });
  const year = currentDate.getFullYear();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const calendarEvents = useMemo(() => {
    const events: Record<number, any[]> = {};
    
    recurring.forEach(r => {
      const [y, m, d] = r.startDate.split('-').map(Number);
      const start = new Date(y, m - 1, d);
      
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
        const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();

        if (dateMidnight < startMidnight) continue;

        let isMatch = false;
        if (r.frequency === 'Monthly') {
          isMatch = date.getDate() === start.getDate();
        } else if (r.frequency === 'Weekly') {
          isMatch = date.getDay() === start.getDay();
        } else if (r.frequency === 'Daily') {
          isMatch = true;
        } else if (r.frequency === 'Yearly') {
          isMatch = date.getDate() === start.getDate() && date.getMonth() === start.getMonth();
        }

        if (isMatch) {
          if (!events[i]) events[i] = [];
          events[i].push(r);
        }
      }
    });

    return events;
  }, [recurring, currentDate, daysInMonth]);

  const dailyProjectedBalances = useMemo(() => {
    const balances: Record<number, Record<number, number>> = {};
    let runningBalances = { ...accountBalances };

    for (let i = 1; i <= daysInMonth; i++) {
      const dayEvents = calendarEvents[i] || [];
      dayEvents.forEach(e => {
        if (e.type === 'Income') {
          runningBalances[e.accountId] = (runningBalances[e.accountId] || 0) + e.amount;
        } else if (e.type === 'Expense') {
          runningBalances[e.accountId] = (runningBalances[e.accountId] || 0) - e.amount;
        } else if (e.type === 'Transfer') {
          runningBalances[e.accountId] = (runningBalances[e.accountId] || 0) - e.amount;
          if (e.toAccountId) {
            runningBalances[e.toAccountId] = (runningBalances[e.toAccountId] || 0) + e.amount;
          }
        }
      });
      balances[i] = { ...runningBalances };
    }
    return balances;
  }, [calendarEvents, accountBalances, daysInMonth]);

  const selectedEvents = selectedDay ? calendarEvents[selectedDay] || [] : [];
  const selectedBalances = selectedDay ? dailyProjectedBalances[selectedDay] : null;

  return (
    <div className={`flex flex-col ${compact ? 'gap-4' : 'gap-6'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className={`text-indigo-600 ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />
          <span className={`font-bold text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>Bill Calendar</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </button>
          <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest min-w-[60px] text-center">
            {monthName} {year}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
          <div key={day} className="text-center py-1">
            <span className="text-[8px] font-black text-gray-300 uppercase">{day}</span>
          </div>
        ))}
        
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const events = calendarEvents[day] || [];
          const balances = dailyProjectedBalances[day];
          const hasRisk = Object.values(balances).some(b => b < 0);
          const isSelected = selectedDay === day;
          const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`h-8 rounded-lg flex flex-col items-center justify-center relative transition-all ${
                isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 
                isToday ? 'bg-black text-white' :
                'hover:bg-gray-50 text-gray-600'
              }`}
            >
              <span className="text-[10px] font-bold">{day}</span>
              <div className="flex gap-0.5 mt-0.5">
                {events.length > 0 && (
                  <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-400'}`} />
                )}
                {hasRisk && (
                  <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day Details */}
      <AnimatePresence mode="wait">
        {selectedDay && (
          <motion.div
            key={selectedDay}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gray-50 rounded-2xl p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {selectedDay} {monthName}
              </span>
              {selectedBalances && Object.values(selectedBalances).some(b => b < 0) && (
                <div className="flex items-center gap-1 text-rose-600">
                  <AlertCircle className="w-3 h-3" />
                  <span className="text-[8px] font-bold uppercase">Risk</span>
                </div>
              )}
            </div>

            {selectedEvents.length > 0 ? (
              <div className="space-y-2">
                {selectedEvents.map((e, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1 rounded-md ${
                        e.type === 'Income' ? 'bg-emerald-100 text-emerald-600' :
                        e.type === 'Expense' ? 'bg-rose-100 text-rose-600' :
                        'bg-indigo-100 text-indigo-600'
                      }`}>
                        {e.type === 'Income' ? <ArrowUpRight className="w-3 h-3" /> : 
                         e.type === 'Expense' ? <ArrowDownLeft className="w-3 h-3" /> : 
                         <RefreshCw className="w-3 h-3" />}
                      </div>
                      <span className="text-[10px] font-bold text-gray-700 truncate">{e.description}</span>
                    </div>
                    <span className={`text-[10px] font-black ${
                      e.type === 'Income' ? 'text-emerald-600' : 
                      e.type === 'Expense' ? 'text-rose-600' : 'text-indigo-600'
                    }`}>
                      ${e.amount}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] font-medium text-gray-400 italic">No scheduled transactions</p>
            )}

            {selectedBalances && (
              <div className="pt-2 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedBalances).map(([accId, bal]) => {
                    const acc = accounts.find(a => a.id === Number(accId));
                    if (!acc || bal === 0) return null;
                    return (
                      <div key={accId} className="flex flex-col">
                        <span className="text-[8px] font-bold text-gray-400 truncate uppercase">{acc.name}</span>
                        <span className={`text-[10px] font-black ${bal < 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                          ${bal.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
