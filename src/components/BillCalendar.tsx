import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RecurringTransaction, Account } from '../lib/db';

interface BillCalendarProps {
  recurring: RecurringTransaction[];
  accounts: Account[];
  accountBalances: Record<number, number>;
}

export default function BillCalendar({ recurring, accounts, accountBalances }: BillCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const calendarEvents = useMemo(() => {
    const events: Record<number, any[]> = {};
    
    recurring.forEach(r => {
      const start = new Date(r.startDate);
      
      // Simple logic for monthly/weekly recurring
      if (r.frequency === 'Monthly') {
        const day = start.getDate();
        if (!events[day]) events[day] = [];
        events[day].push(r);
      } else if (r.frequency === 'Weekly') {
        const startDay = start.getDay();
        for (let i = 1; i <= daysInMonth; i++) {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
          if (date.getDay() === startDay) {
            if (!events[i]) events[i] = [];
            events[i].push(r);
          }
        }
      }
    });

    return events;
  }, [recurring, currentDate, daysInMonth]);

  const getAccountName = (id: number) => accounts.find(a => a.id === id)?.name || 'Unknown';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900">Bill Calendar</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Projected Cash Flow for {monthName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-2xl">
          <button onClick={prevMonth} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <span className="px-4 text-sm font-black text-gray-900">{monthName} {year}</span>
          <button onClick={nextMonth} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm">
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-[32px] overflow-hidden border border-gray-100 shadow-sm">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-gray-50/50 p-4 text-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{day}</span>
          </div>
        ))}
        
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-white/50 h-32" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const events = calendarEvents[day] || [];
          const balances = dailyProjectedBalances[day];
          const hasRisk = Object.values(balances).some(b => b < 0);

          return (
            <div key={day} className="bg-white h-40 p-3 flex flex-col gap-1 border-t border-l border-gray-50 hover:bg-gray-50/50 transition-colors group">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-black ${day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() ? 'w-6 h-6 bg-black text-white rounded-full flex items-center justify-center' : 'text-gray-400'}`}>
                  {day}
                </span>
                {hasRisk && (
                  <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse" />
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                {events.map((e, idx) => (
                  <div 
                    key={idx}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold truncate ${
                      e.type === 'Income' ? 'bg-emerald-50 text-emerald-700' :
                      e.type === 'Expense' ? 'bg-rose-50 text-rose-700' :
                      'bg-indigo-50 text-indigo-700'
                    }`}
                    title={`${e.description}: $${e.amount}`}
                  >
                    {e.type === 'Income' ? '+' : e.type === 'Expense' ? '-' : '⇄'} ${e.amount} {e.description}
                  </div>
                ))}
              </div>

              <div className="pt-2 mt-auto border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex flex-col gap-0.5">
                  {Object.entries(balances).map(([accId, bal]) => {
                    const acc = accounts.find(a => a.id === Number(accId));
                    if (!acc || bal === 0) return null;
                    return (
                      <div key={accId} className="flex items-center justify-between text-[8px] font-bold">
                        <span className="text-gray-400 truncate max-w-[40px]">{acc.name}</span>
                        <span className={bal < 0 ? 'text-rose-500' : 'text-gray-600'}>${bal.toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
        <h4 className="text-sm font-black text-gray-900 mb-6 uppercase tracking-widest">Cash Flow Analysis</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">Safe Days</span>
            </div>
            <p className="text-2xl font-black text-emerald-600">
              {Object.values(dailyProjectedBalances).filter(b => Object.values(b).every(v => v >= 0)).length} / {daysInMonth}
            </p>
            <p className="text-[10px] font-bold text-emerald-700 mt-1">Days with positive balances in all accounts</p>
          </div>

          <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <span className="text-xs font-black text-rose-800 uppercase tracking-widest">Risk Alerts</span>
            </div>
            <p className="text-2xl font-black text-rose-600">
              {Object.values(dailyProjectedBalances).filter(b => Object.values(b).some(v => v < 0)).length} Days
            </p>
            <p className="text-[10px] font-bold text-rose-700 mt-1">Potential overdrafts detected</p>
          </div>

          <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
            <div className="flex items-center gap-3 mb-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
              <span className="text-xs font-black text-indigo-800 uppercase tracking-widest">Total Recurring</span>
            </div>
            <p className="text-2xl font-black text-indigo-600">
              ${recurring.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
            </p>
            <p className="text-[10px] font-bold text-indigo-700 mt-1">Total monthly fixed commitments</p>
          </div>
        </div>
      </div>
    </div>
  );
}
