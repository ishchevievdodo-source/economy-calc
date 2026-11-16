export type Transaction = { id: string; type: 'income' | 'expense' | 'saving'; amount: number; category: string; note: string; date: string }
export type Goal = { id: string; name: string; target: number; saved: number; deadline: string; emoji: string }
export type Purchase = { id: string; name: string; amount: number; due: string; priority: 'Обязательно' | 'Желательно' | 'Можно позже'; done: boolean }
export type BudgetItem = { id: string; name: string; planned: number; color: string }
export type Meal = { day: string; dish: string; cost: number }
export type AppData = { weddingDate: string; goals: Goal[]; purchases: Purchase[]; budget: BudgetItem[]; transactions: Transaction[]; meals: Meal[] }

