import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Target, Zap, Medal, Star, ChevronRight, Award } from 'lucide-react';
import { Milestone } from '../lib/db';

interface MilestonesProps {
  milestones: Milestone[];
}

const iconMap: Record<string, React.ReactNode> = {
  Trophy: <Trophy className="w-5 h-5 text-yellow-500" />,
  Target: <Target className="w-5 h-5 text-blue-500" />,
  Zap: <Zap className="w-5 h-5 text-indigo-500" />,
  Medal: <Medal className="w-5 h-5 text-purple-500" />,
  Star: <Star className="w-5 h-5 text-amber-500" />,
  Award: <Award className="w-5 h-5 text-emerald-500" />,
};

export const Milestones: React.FC<MilestonesProps> = ({ milestones }) => {
  if (milestones.length === 0) return null;

  // Sort milestones by date (newest first)
  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(b.achievedDate).getTime() - new Date(a.achievedDate).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-600" />
          Milestones & Achievements
        </h2>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {milestones.length} Unlocked
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {sortedMilestones.map((milestone) => (
            <motion.div
              key={milestone.id}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              whileHover={{ y: -2 }}
              className="relative overflow-hidden bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group"
            >
              {/* Background Glow */}
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex gap-4 relative z-10">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 group-hover:bg-white group-hover:border-indigo-100 transition-colors">
                  {iconMap[milestone.icon] || <Medal className="w-5 h-5 text-gray-400" />}
                </div>
                
                <div className="flex-grow min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                      {milestone.name}
                    </h3>
                    {milestone.type === 'streak' && (
                      <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        <Zap className="w-2.5 h-2.5 fill-current" />
                        {milestone.value} Month Streak
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                    {milestone.description}
                  </p>
                  
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                      Unlocked {new Date(milestone.achievedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <motion.div
                      whileHover={{ x: 3 }}
                      className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Progress Bar for Streaks (Visual only) */}
              {milestone.type === 'streak' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-indigo-500 opacity-20"
                  />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
