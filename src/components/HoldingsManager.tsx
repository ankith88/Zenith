import React, { useState } from 'react';
import { Plus, Rocket, Gem, Coins, Home, Car, TrendingUp, TrendingDown, Edit2, Trash2, Loader2, X, Activity, DollarSign, Package, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, Investment, Asset } from '../lib/db';
import { getCurrencySymbol } from '../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface HoldingsManagerProps {
  investments: Investment[];
  assets: Asset[];
  displayCurrency: string;
}

export default function HoldingsManager({ investments, assets, displayCurrency }: HoldingsManagerProps) {
  const [activeTab, setActiveTab] = useState<'investments' | 'assets'>('investments');
  const [isAddingInvestment, setIsAddingInvestment] = useState(false);
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [investmentForm, setInvestmentForm] = useState({
    name: '',
    symbol: '',
    type: 'Stock',
    quantity: '',
    costBasis: '',
    currentPrice: '',
    datePurchased: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [assetForm, setAssetForm] = useState({
    name: '',
    type: 'Property',
    purchasePrice: '',
    currentValuation: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const totalInvestmentValue = investments.reduce((sum, i) => sum + (i.quantity * i.currentPrice), 0);
  const totalInvestmentCost = investments.reduce((sum, i) => sum + i.costBasis, 0);
  const portfolioReturn = totalInvestmentCost > 0 ? ((totalInvestmentValue - totalInvestmentCost) / totalInvestmentCost) * 100 : 0;

  const totalAssetValue = assets.reduce((sum, a) => sum + a.currentValuation, 0);
  const totalHoldingsValue = totalInvestmentValue + totalAssetValue;

  const chartData = [
    { name: 'Stocks', value: investments.filter(i => i.type === 'Stock').reduce((sum, i) => sum + (i.quantity * i.currentPrice), 0), color: '#3b82f6' },
    { name: 'Crypto', value: investments.filter(i => i.type === 'Crypto').reduce((sum, i) => sum + (i.quantity * i.currentPrice), 0), color: '#f59e0b' },
    { name: 'Mutual Funds', value: investments.filter(i => i.type === 'Mutual Fund').reduce((sum, i) => sum + (i.quantity * i.currentPrice), 0), color: '#10b981' },
    { name: 'Properties', value: assets.filter(a => a.type === 'Property').reduce((sum, a) => sum + a.currentValuation, 0), color: '#8b5cf6' },
    { name: 'Vehicles', value: assets.filter(a => a.type === 'Vehicle').reduce((sum, a) => sum + a.currentValuation, 0), color: '#ec4899' },
  ].filter(d => d.value > 0);

  const handleInvestmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = {
        name: investmentForm.name,
        symbol: investmentForm.symbol.toUpperCase(),
        type: investmentForm.type as any,
        quantity: parseFloat(investmentForm.quantity),
        costBasis: parseFloat(investmentForm.costBasis),
        currentPrice: parseFloat(investmentForm.currentPrice),
        datePurchased: investmentForm.datePurchased,
        notes: investmentForm.notes,
        synced: false
      };

      if (editingInvestment) {
        await db.investments.update(editingInvestment.id!, data);
      } else {
        await db.investments.add(data);
      }
      setIsAddingInvestment(false);
      setEditingInvestment(null);
      setInvestmentForm({ name: '', symbol: '', type: 'Stock', quantity: '', costBasis: '', currentPrice: '', datePurchased: new Date().toISOString().split('T')[0], notes: '' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = {
        name: assetForm.name,
        type: assetForm.type as any,
        purchasePrice: parseFloat(assetForm.purchasePrice),
        currentValuation: parseFloat(assetForm.currentValuation),
        purchaseDate: assetForm.purchaseDate,
        notes: assetForm.notes,
        synced: false
      };

      if (editingAsset) {
        await db.assets.update(editingAsset.id!, data);
      } else {
        await db.assets.add(data);
      }
      setIsAddingAsset(false);
      setEditingAsset(null);
      setAssetForm({ name: '', type: 'Property', purchasePrice: '', currentValuation: '', purchaseDate: new Date().toISOString().split('T')[0], notes: '' });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteInvestment = async (id: number) => {
    if (confirm('Are you sure you want to remove this investment?')) {
      await db.investments.delete(id);
    }
  };

  const deleteAsset = async (id: number) => {
    if (confirm('Are you sure you want to remove this asset?')) {
      await db.assets.delete(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-2">
          <h2 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            Holdings Portfolio
            <Activity className="w-6 h-6 text-indigo-500" />
          </h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Manage your wealth across investments and physical assets.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Worth Impact</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white">
              {getCurrencySymbol(displayCurrency)}{totalHoldingsValue.toLocaleString()}
            </p>
          </div>
          <button 
            onClick={() => activeTab === 'investments' ? setIsAddingInvestment(true) : setIsAddingAsset(true)}
            className="p-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl shadow-xl shadow-black/10 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('investments')}
          className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'investments' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          Investments
        </button>
        <button
          onClick={() => setActiveTab('assets')}
          className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'assets' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
        >
          Assets
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List */}
        <div className="lg:col-span-2 space-y-4">
          {activeTab === 'investments' ? (
            investments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {investments.map(inv => {
                  const val = inv.quantity * inv.currentPrice;
                  const profit = val - inv.costBasis;
                  const profitPct = (profit / inv.costBasis) * 100;
                  return (
                    <motion.div 
                      layout
                      key={inv.id} 
                      className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm group hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-2xl ${
                            inv.type === 'Stock' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' :
                            inv.type === 'Crypto' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' :
                            'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
                          }`}>
                            {inv.type === 'Stock' ? <TrendingUp className="w-5 h-5" /> : 
                             inv.type === 'Crypto' ? <Coins className="w-5 h-5" /> : <Rocket className="w-5 h-5" />}
                          </div>
                          <div>
                            <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{inv.symbol || inv.name}</h4>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{inv.name}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingInvestment(inv); setInvestmentForm({ ...inv } as any); setIsAddingInvestment(true); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => inv.id && deleteInvestment(inv.id)} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-rose-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Market Value</p>
                            <p className="text-xl font-black text-gray-900 dark:text-white">{getCurrencySymbol(displayCurrency)}{val.toLocaleString()}</p>
                          </div>
                          <div className={`text-right ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <div className="flex items-center justify-end gap-1 font-black text-xs">
                              {profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {profitPct.toFixed(2)}%
                            </div>
                            <p className="text-[10px] font-bold">{profit >= 0 ? '+' : ''}{getCurrencySymbol(displayCurrency)}{profit.toLocaleString()}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                          <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Holdings</p>
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{inv.quantity.toLocaleString()} units</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Avg. Cost</p>
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{getCurrencySymbol(displayCurrency)}{(inv.costBasis / inv.quantity).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Rocket className="w-10 h-10 text-indigo-500" />
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">No Investments Asset</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto text-sm font-medium">Add your stocks, crypto or mutual funds to track your performance over time.</p>
              </div>
            )
          ) : (
            assets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {assets.map(asset => {
                  const appreciation = asset.currentValuation - asset.purchasePrice;
                  const appreciationPct = (appreciation / asset.purchasePrice) * 100;
                  return (
                    <motion.div 
                      layout
                      key={asset.id} 
                      className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm group hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-2xl ${
                            asset.type === 'Property' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500' :
                            asset.type === 'Vehicle' ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-500' :
                            'bg-violet-50 dark:bg-violet-900/20 text-violet-500'
                          }`}>
                            {asset.type === 'Property' ? <Home className="w-5 h-5" /> : 
                             asset.type === 'Vehicle' ? <Car className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                          </div>
                          <div>
                            <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-tight">{asset.name}</h4>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{asset.type}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingAsset(asset); setAssetForm({ ...asset } as any); setIsAddingAsset(true); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => asset.id && deleteAsset(asset.id)} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-rose-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Current Valuation</p>
                          <p className="text-xl font-black text-gray-900 dark:text-white">{getCurrencySymbol(displayCurrency)}{asset.currentValuation.toLocaleString()}</p>
                        </div>
                        
                        <div className="flex justify-between items-center pt-4 border-t border-gray-50 dark:border-gray-800">
                          <div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Purchased For</p>
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{getCurrencySymbol(displayCurrency)}{asset.purchasePrice.toLocaleString()}</p>
                          </div>
                          <div className={`text-right ${appreciation >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            <div className="flex items-center justify-end gap-1 font-black text-[10px]">
                              {appreciation >= 0 ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
                              {appreciationPct.toFixed(1)}%
                            </div>
                            <p className="text-[9px] font-bold capitalize">{appreciation >= 0 ? 'appreciation' : 'depreciation'}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[2.5rem] p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                <div className="w-20 h-20 bg-pink-50 dark:bg-pink-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Home className="w-10 h-10 text-pink-500" />
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">No Physical Assets</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto text-sm font-medium">Keep track of your high-value possessions like real estate, vehicles, or luxury goods.</p>
              </div>
            )
          )}
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
          {/* Donut Chart */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Portfolio Distribution</h4>
            {chartData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: 'none', borderRadius: '12px', color: '#fff' }}
                      itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                      formatter={(val: number) => [`${getCurrencySymbol(displayCurrency)}${val.toLocaleString()}`, 'Value']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase">No Data Yet</p>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {chartData.map(d => (
                <div key={d.name} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">{d.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-gray-900 dark:text-white">{((d.value / totalHoldingsValue) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Overview */}
          <div className="bg-black dark:bg-white p-6 rounded-[2.5rem] text-white dark:text-black shadow-2xl shadow-black/10">
            <h4 className="text-[10px] font-black text-white/40 dark:text-black/40 uppercase tracking-widest mb-4">Investment Performance</h4>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-white/60 dark:text-black/60 uppercase">Portfolio Return</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-black">{portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}%</p>
                  <div className={`p-1 rounded-lg ${portfolioReturn >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {portfolioReturn >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 dark:border-black/10">
                <div>
                  <p className="text-[9px] font-bold text-white/40 dark:text-black/40 uppercase">Total Gain</p>
                  <p className="text-sm font-black text-emerald-400">{getCurrencySymbol(displayCurrency)}{(totalInvestmentValue - totalInvestmentCost).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-white/40 dark:text-black/40 uppercase">Asset Worth</p>
                  <p className="text-sm font-black">{getCurrencySymbol(displayCurrency)}{totalAssetValue.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {(isAddingInvestment || editingInvestment) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/20 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingInvestment ? 'Edit Investment' : 'New Investment'}
                </h3>
                <button onClick={() => { setIsAddingInvestment(false); setEditingInvestment(null); }} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleInvestmentSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Holding Name</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      value={investmentForm.name}
                      onChange={e => setInvestmentForm({...investmentForm, name: e.target.value})}
                      placeholder="e.g., Apple Inc."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Symbol</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      value={investmentForm.symbol}
                      onChange={e => setInvestmentForm({...investmentForm, symbol: e.target.value})}
                      placeholder="e.g., AAPL"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Type</label>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      value={investmentForm.type}
                      onChange={e => setInvestmentForm({...investmentForm, type: e.target.value})}
                    >
                      <option value="Stock">Stock</option>
                      <option value="Crypto">Crypto</option>
                      <option value="Mutual Fund">Mutual Fund</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Quantity</label>
                    <input
                      required
                      type="number"
                      step="any"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      value={investmentForm.quantity}
                      onChange={e => setInvestmentForm({...investmentForm, quantity: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Total Cost Basis</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      value={investmentForm.costBasis}
                      onChange={e => setInvestmentForm({...investmentForm, costBasis: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Current Price (Unit)</label>
                    <input
                      required
                      type="number"
                      step="any"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      value={investmentForm.currentPrice}
                      onChange={e => setInvestmentForm({...investmentForm, currentPrice: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Purchase Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="date"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                        value={investmentForm.datePurchased}
                        onChange={e => setInvestmentForm({...investmentForm, datePurchased: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <button
                  disabled={isLoading}
                  className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black mt-4 flex items-center justify-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingInvestment ? 'Save Changes' : 'Add Investment'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {(isAddingAsset || editingAsset) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/20 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                   {editingAsset ? 'Edit Asset' : 'New Physical Asset'}
                </h3>
                <button onClick={() => { setIsAddingAsset(false); setEditingAsset(null); }} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <form onSubmit={handleAssetSubmit} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Asset Name</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    value={assetForm.name}
                    onChange={e => setAssetForm({...assetForm, name: e.target.value})}
                    placeholder="e.g., 2024 Tesla Model Y"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Type</label>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      value={assetForm.type}
                      onChange={e => setAssetForm({...assetForm, type: e.target.value})}
                    >
                      <option value="Property">Property</option>
                      <option value="Vehicle">Vehicle</option>
                      <option value="Collectibles">Collectibles</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Purchase Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      value={assetForm.purchaseDate}
                      onChange={e => setAssetForm({...assetForm, purchaseDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Purchase Price</label>
                    <input
                      required
                      type="number"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      value={assetForm.purchasePrice}
                      onChange={e => setAssetForm({...assetForm, purchasePrice: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Current Valuation</label>
                    <input
                      required
                      type="number"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                      value={assetForm.currentValuation}
                      onChange={e => setAssetForm({...assetForm, currentValuation: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <button
                  disabled={isLoading}
                  className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black mt-4 flex items-center justify-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingAsset ? 'Save Changes' : 'Add Asset'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
