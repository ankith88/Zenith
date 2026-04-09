import { db, Milestone, Goal, Transaction, Budget } from './db';
import { sheetsService } from './sheets';

export class MilestoneService {
  async checkMilestones() {
    const goals = await db.goals.toArray();
    const transactions = await db.transactions.toArray();
    const budgets = await db.budgets.toArray();
    const existingMilestones = await db.milestones.toArray();

    await this.checkGoalMilestones(goals, existingMilestones);
    await this.checkBudgetStreaks(transactions, budgets, existingMilestones);
    await this.checkWelcomeMilestone(existingMilestones);
  }

  private async checkWelcomeMilestone(existingMilestones: Milestone[]) {
    const milestoneName = 'Zenith Pioneer';
    const alreadyAchieved = existingMilestones.some(m => m.name === milestoneName);

    if (!alreadyAchieved) {
      const newMilestone: Milestone = {
        type: 'badge',
        name: milestoneName,
        description: 'Welcome to Zenith! You\'ve taken the first step towards financial mastery.',
        icon: 'Award',
        achievedDate: new Date().toISOString(),
        synced: false
      };
      const id = await db.milestones.add(newMilestone);
      newMilestone.id = id;
      await sheetsService.appendMilestone(newMilestone);
    }
  }

  private async checkGoalMilestones(goals: Goal[], existingMilestones: Milestone[]) {
    for (const goal of goals) {
      const progress = (goal.currentAmount / goal.targetAmount) * 100;
      
      if (progress >= 50) {
        const milestoneName = `Halfway Hero: ${goal.name}`;
        const alreadyAchieved = existingMilestones.some(m => m.name === milestoneName);
        
        if (!alreadyAchieved) {
          const newMilestone: Milestone = {
            type: 'badge',
            name: milestoneName,
            description: `You've reached 50% of your goal for "${goal.name}"!`,
            icon: 'Trophy',
            achievedDate: new Date().toISOString(),
            synced: false
          };
          const id = await db.milestones.add(newMilestone);
          newMilestone.id = id;
          await sheetsService.appendMilestone(newMilestone);
        }
      }

      if (progress >= 100) {
        const milestoneName = `Goal Crusher: ${goal.name}`;
        const alreadyAchieved = existingMilestones.some(m => m.name === milestoneName);
        
        if (!alreadyAchieved) {
          const newMilestone: Milestone = {
            type: 'badge',
            name: milestoneName,
            description: `Congratulations! You've fully achieved your goal for "${goal.name}"!`,
            icon: 'Target',
            achievedDate: new Date().toISOString(),
            synced: false
          };
          const id = await db.milestones.add(newMilestone);
          newMilestone.id = id;
          await sheetsService.appendMilestone(newMilestone);
        }
      }
    }
  }

  private async checkBudgetStreaks(transactions: Transaction[], budgets: Budget[], existingMilestones: Milestone[]) {
    if (budgets.length === 0) return;

    // Group transactions by month
    const monthlySpending: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.type !== 'Expense') return;
      const month = t.date.substring(0, 7); // YYYY-MM
      monthlySpending[month] = (monthlySpending[month] || 0) + t.amount;
    });

    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const months = Object.keys(monthlySpending).sort().reverse();
    
    let streak = 0;
    for (const month of months) {
      if (monthlySpending[month] <= totalBudget) {
        streak++;
      } else {
        break;
      }
    }

    if (streak >= 3) {
      const milestoneName = 'Budget Master Streak';
      const existingStreak = existingMilestones.find(m => m.name === milestoneName);
      
      if (!existingStreak || (existingStreak.value || 0) < streak) {
        const newMilestone: Milestone = {
          type: 'streak',
          name: milestoneName,
          description: `You've stayed under budget for ${streak} months in a row!`,
          icon: 'Zap',
          achievedDate: new Date().toISOString(),
          value: streak,
          synced: false
        };
        
        if (existingStreak) {
          await db.milestones.update(existingStreak.id!, newMilestone);
          // For simplicity, we just append or we could update. 
          // SheetsService updateMilestone is not implemented yet, so let's just append for now or re-sync everything.
          // Actually, let's just re-sync to remote if it's a streak update.
          await sheetsService.syncToRemote();
        } else {
          const id = await db.milestones.add(newMilestone);
          newMilestone.id = id;
          await sheetsService.appendMilestone(newMilestone);
        }
      }
    }
  }
}

export const milestoneService = new MilestoneService();
