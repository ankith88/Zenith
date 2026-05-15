import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart, ReferenceLine, Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Clock, ArrowRight, Target, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Transaction, Budget, Account } from '../lib/db';
import { convertCurrency, getCurrencySymbol, parseLocalDate } from '../lib/utils';

interface BudgetPerformanceProps {
  budgets: Budget[];
  transactions: Transaction[];
  accounts: Account[];
  displayCurrency: string;
}

export default function BudgetPerformance({ budgets, transactions, accounts, displayCurrency }: BudgetPerformanceProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const performanceData = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const data = months.map(month => {
      const monthData: any = { 
        month,
        displayName: new Date(month + '-01').toLocaleString('default', { month: 'short' })
      };
      const [year, m] = month.split('-').map(Number);
      
      const monthTransactions = transactions.filter(t => {
        const date = parseLocalDate(t.date);
        return date.getFullYear() === year && date.getMonth() === m - 1 && t.type === 'Expense';
      });

      let totalMonthlySpent = 0;
      let totalMonthlyBudget = 0;

      budgets.forEach(budget => {
        const spent = monthTransactions
          .filter(t => t.category === budget.category)
          .reduce((sum, t) => {
            const acc = accounts.find(a => a.id === t.accountId);
            return sum + convertCurrency(t.amount, acc?.currency || 'USD', displayCurrency);
          }, 0);
        
        monthData[budget.category] = Math.round(spent);
        monthData[`${budget.category}_limit`] = budget.amount;
        totalMonthlySpent += spent;
        totalMonthlyBudget += budget.amount;
      });

      monthData.totalSpent = Math.round(totalMonthlySpent);
      monthData.totalBudget = totalMonthlyBudget;

      return monthData;
    });

    return data;
  }, [budgets, transactions, accounts, displayCurrency]);

  if (budgets.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 p-12 rounded-[2rem] border border-gray-100 dark:border-gray-800 text-center">
        <Target className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Budgets Defined</h4>
        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
          Set up some spending limits first to see your historical performance data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Performance History</h4>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            {selectedCategory ? `Actual vs Budget: ${selectedCategory}` : 'Aggregate Spending Trends vs Budget'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCategory && (
            <button 
              onClick={() => setSelectedCategory(null)}
              className="px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all"
            >
              Reset View
            </button>
          )}
          <Clock className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div className="h-[350px] w-full bg-white dark:bg-gray-900/50 rounded-3xl p-4 border border-gray-50 dark:border-gray-800/50">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-chart-grid)" opacity={0.1} />
            <XAxis 
              dataKey="displayName" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 'bold' }}
              tickFormatter={(val) => `${getCurrencySymbol(displayCurrency)}${val.toLocaleString()}`}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
              contentStyle={{ 
                borderRadius: '20px', 
                border: 'none', 
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                fontSize: '12px',
                fontWeight: 'bold',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)'
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
            
            {selectedCategory ? (
              <>
                <Bar 
                  dataKey={selectedCategory} 
                  name="Actual Spending"
                  fill="#6366f1" 
                  radius={[8, 8, 0, 0]} 
                  barSize={40}
                >
                  {performanceData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry[selectedCategory] > entry[`${selectedCategory}_limit`] ? '#f87171' : '#818cf8'} 
                      fillOpacity={index === performanceData.length - 1 ? 1 : 0.6}
                    />
                  ))}
                </Bar>
                <Line 
                  type="monotone" 
                  dataKey={`${selectedCategory}_limit`} 
                  name="Budget Limit"
                  stroke="#ef4444" 
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ r: 6, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
                />
                <ReferenceLine y={performanceData[performanceData.length - 1][`${selectedCategory}_limit`]} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'LIMIT', fill: '#ef4444', fontSize: 10, fontWeight: 'black' }} />
              </>
            ) : (
              <>
                {budgets.map((budget, i) => (
                  <Bar 
                    key={budget.id} 
                    dataKey={budget.category} 
                    name={budget.category}
                    stackId="a" 
                    fill={`hsl(${i * 137.5 % 360}, 60%, 60%)`} 
                    radius={i === budgets.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                  />
                ))}
                <Line 
                  type="monotone" 
                  dataKey="totalBudget" 
                  name="Total Budget"
                  stroke="#ef4444" 
                  strokeWidth={3}
                  strokeDasharray="8 4"
                  dot={{ r: 6, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgets.map(budget => {
          const currentMonth = performanceData[performanceData.length - 1][budget.category] || 0;
          const prevMonth = performanceData[performanceData.length - 2][budget.category] || 0;
          const isOverBudget = currentMonth > budget.amount;
          const diff = currentMonth - prevMonth;
          const percentChange = prevMonth > 0 ? (diff / prevMonth) * 100 : 0;

          return (
            <button 
              key={budget.id} 
              onClick={() => setSelectedCategory(budget.category === selectedCategory ? null : budget.category)}
              className={`p-5 rounded-[2rem] border transition-all text-left flex items-center justify-between group relative overflow-hidden ${
                selectedCategory === budget.category 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-500/20 active:scale-95' 
                  : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md'
              }`}
            >
              {isOverBudget && selectedCategory !== budget.category && (
                <div className="absolute top-0 right-0 p-2">
                  <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
                </div>
              )}
              
              <div className="relative z-10">
                <p className={`text-[10px] font-black uppercase tracking-widest ${selectedCategory === budget.category ? 'text-indigo-100' : 'text-gray-400'}`}>
                  {budget.category}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xl font-black ${selectedCategory === budget.category ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    {getCurrencySymbol(displayCurrency)}{currentMonth.toLocaleString()}
                  </span>
                  <span className={`text-[10px] font-black flex items-center ${
                    selectedCategory === budget.category 
                      ? 'text-indigo-100' 
                      : diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-gray-400'
                  }`}>
                    {diff > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : diff < 0 ? <TrendingDown className="w-3 h-3 mr-0.5" /> : null}
                    {Math.abs(Math.round(percentChange))}%
                  </span>
                </div>
                {isOverBudget && (
                  <p className={`text-[9px] font-bold mt-1 ${selectedCategory === budget.category ? 'text-indigo-200' : 'text-red-500'}`}>
                    {getCurrencySymbol(displayCurrency)}{(currentMonth - budget.amount).toLocaleString()} OVER LIMIT
                  </p>
                )}
              </div>

              <div className="text-right relative z-10 shrink-0 ml-4">
                <p className={`text-[8px] font-black uppercase tracking-widest ${selectedCategory === budget.category ? 'text-indigo-200' : 'text-gray-400'}`}>
                  Limit
                </p>
                <p className={`text-sm font-bold ${selectedCategory === budget.category ? 'text-white' : 'text-gray-400'}`}>
                  {getCurrencySymbol(displayCurrency)}{budget.amount.toLocaleString()}
                </p>
                <div className={`mt-2 flex items-center justify-end ${selectedCategory === budget.category ? 'text-white' : 'text-indigo-600'}`}>
                  {selectedCategory === budget.category ? <CheckCircle2 className="w-4 h-4" /> : <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
