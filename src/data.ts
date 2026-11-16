import type { AppData } from './types'

export const initialData: AppData = {
  weddingDate: '2027-07-23',
  goals: [
    { id: crypto.randomUUID(), name: 'Путешествие к морю', target: 320000, saved: 0, deadline: '2027-07-24', emoji: '🌊' },
  ],
  purchases: [
    { id: crypto.randomUUID(), name: 'Платье', amount: 0, due: '2027-06-15', priority: 'Обязательно', done: false },
    { id: crypto.randomUUID(), name: 'Костюм', amount: 0, due: '2027-06-15', priority: 'Обязательно', done: false },
    { id: crypto.randomUUID(), name: 'Трансфер для родственников', amount: 0, due: '2027-07-23', priority: 'Обязательно', done: false },
  ],
  budget: [
    { id: crypto.randomUUID(), name: 'Продукты', planned: 30000, color: '#e7a95a' },
    { id: crypto.randomUUID(), name: 'Транспорт', planned: 10000, color: '#74a69a' },
    { id: crypto.randomUUID(), name: 'Дом', planned: 8000, color: '#8f7bb8' },
    { id: crypto.randomUUID(), name: 'Личное', planned: 8000, color: '#d47b77' },
    { id: crypto.randomUUID(), name: 'Подготовка', planned: 20000, color: '#7390bf' },
  ],
  transactions: [],
  meals: [
    'Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье',
  ].map((day) => ({ day, dish: '', cost: 0 })),
}

