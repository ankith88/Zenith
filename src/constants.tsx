import React from 'react';
import { 
  Utensils, Car, ShoppingBag, Film, Home, HeartPulse, 
  Zap, DollarSign, TrendingUp, Wallet, ArrowLeftRight,
  ShieldCheck, GraduationCap, Plane, Coffee, Briefcase,
  Music, Tv, Gamepad2, Laptop, Shirt, Dumbbell, 
  Gift, Heart, PawPrint, Wrench, Fuel, Bus, 
  Hotel, Pizza, Beer, BookOpen, Pill, Stethoscope,
  Wifi, Phone, Droplet, Flame, Baby, Puzzle,
  PlusCircle, RefreshCw, Undo2, Receipt
} from 'lucide-react';

export const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  // Food & Drink
  'Food': <Utensils className="w-full h-full" />,
  'Dining Out': <Utensils className="w-full h-full" />,
  'Groceries': <ShoppingBag className="w-full h-full" />,
  'Coffee': <Coffee className="w-full h-full" />,
  'Restaurants': <Pizza className="w-full h-full" />,
  'Dining': <Pizza className="w-full h-full" />,
  'Bars': <Beer className="w-full h-full" />,
  'Alcohol': <Beer className="w-full h-full" />,
  
  // Transport
  'Transport': <Car className="w-full h-full" />,
  'Transportation': <Car className="w-full h-full" />,
  'Fuel': <Fuel className="w-full h-full" />,
  'Gas': <Fuel className="w-full h-full" />,
  'Parking': <Car className="w-full h-full" />,
  'Public Transport': <Bus className="w-full h-full" />,
  'Bus': <Bus className="w-full h-full" />,
  'Train': <Bus className="w-full h-full" />,
  
  // Shopping & Lifestyle
  'Shopping': <ShoppingBag className="w-full h-full" />,
  'Electronics': <Laptop className="w-full h-full" />,
  'Clothes': <Shirt className="w-full h-full" />,
  'Clothing': <Shirt className="w-full h-full" />,
  'Gifts': <Gift className="w-full h-full" />,
  'Hobbies': <Puzzle className="w-full h-full" />,
  'Pets': <PawPrint className="w-full h-full" />,
  'Beauty': <Heart className="w-full h-full" />,
  'Fitness': <Dumbbell className="w-full h-full" />,
  'Sports': <Dumbbell className="w-full h-full" />,
  
  // Entertainment
  'Entertainment': <Film className="w-full h-full" />,
  'Cinema': <Film className="w-full h-full" />,
  'Movies': <Film className="w-full h-full" />,
  'Music': <Music className="w-full h-full" />,
  'Streaming': <Tv className="w-full h-full" />,
  'Subscriptions': <Tv className="w-full h-full" />,
  'Games': <Gamepad2 className="w-full h-full" />,
  'Gaming': <Gamepad2 className="w-full h-full" />,
  'Books': <BookOpen className="w-full h-full" />,
  
  // Housing & Utilities
  'Housing': <Home className="w-full h-full" />,
  'Rent': <Home className="w-full h-full" />,
  'Mortgage': <Home className="w-full h-full" />,
  'Utilities': <Zap className="w-full h-full" />,
  'Electricity': <Zap className="w-full h-full" />,
  'Water': <Droplet className="w-full h-full" />,
  'Gas Utility': <Flame className="w-full h-full" />,
  'Internet': <Wifi className="w-full h-full" />,
  'Mobile': <Phone className="w-full h-full" />,
  'Phone': <Phone className="w-full h-full" />,
  'Maintenance': <Wrench className="w-full h-full" />,
  'Repairs': <Wrench className="w-full h-full" />,
  
  // Health
  'Health': <HeartPulse className="w-full h-full" />,
  'Medical': <Stethoscope className="w-full h-full" />,
  'Pharmacy': <Pill className="w-full h-full" />,
  'Dentist': <Stethoscope className="w-full h-full" />,
  'Vet': <PawPrint className="w-full h-full" />,
  
  // Travel
  'Travel': <Plane className="w-full h-full" />,
  'Flights': <Plane className="w-full h-full" />,
  'Hotels': <Hotel className="w-full h-full" />,
  
  // Financial & Work
  'Salary': <Briefcase className="w-full h-full" />,
  'Income': <DollarSign className="w-full h-full" />,
  'Bonus': <PlusCircle className="w-full h-full" />,
  'Investment': <TrendingUp className="w-full h-full" />,
  'Dividends': <TrendingUp className="w-full h-full" />,
  'Transfer': <ArrowLeftRight className="w-full h-full" />,
  'Loan': <Receipt className="w-full h-full" />,
  'Taxes': <Receipt className="w-full h-full" />,
  'Refund': <Undo2 className="w-full h-full" />,
  'Insurance': <ShieldCheck className="w-full h-full" />,
  
  // Education & Family
  'Education': <GraduationCap className="w-full h-full" />,
  'School': <GraduationCap className="w-full h-full" />,
  'Childcare': <Baby className="w-full h-full" />,
  'Toys': <Puzzle className="w-full h-full" />,
  'Family': <Heart className="w-full h-full" />,
  
  // Other
  'Other': <Wallet className="w-full h-full" />,
  'General': <Wallet className="w-full h-full" />,
};

export const getCategoryIcon = (category: string, type: string) => {
  const normalized = category.trim();
  if (CATEGORY_ICON_MAP[normalized]) return CATEGORY_ICON_MAP[normalized];
  
  // Try case-insensitive
  const entry = Object.entries(CATEGORY_ICON_MAP).find(
    ([k]) => k.toLowerCase() === normalized.toLowerCase()
  );
  if (entry) return entry[1];

  if (type === 'Income') return <DollarSign className="w-full h-full" />;
  if (type === 'Transfer') return <ArrowLeftRight className="w-full h-full" />;
  return <Wallet className="w-full h-full" />;
};
