import { useMemo, useState, type FormEvent } from 'react'
import { useLocalStore } from './store'
import { telegramCloudEnabled, useCloudSync } from './cloud'
import type { AppData, Goal, Purchase, Transaction } from './types'

type Tab = 'home' | 'plans' | 'budget' | 'meals' | 'settings'
const money = (value: number) => new Intl.NumberFormat('ru-RU').format(Math.round(value)) + ' ₽'
const dateText = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(value + 'T12:00:00'))
const monthKey = new Date().toISOString().slice(0, 7)

function monthsLeft(date: string) {
  const now = new Date()
  const end = new Date(date + 'T23:59:59')
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 2629800000))
}

function daysLeft(date: string) {
  return Math.max(0, Math.ceil((new Date(date + 'T23:59:59').getTime() - Date.now()) / 86400000))
}

const nav: { id: Tab; icon: string; label: string }[] = [
  { id: 'home', icon: '⌂', label: 'Главная' },
  { id: 'plans', icon: '◇', label: 'Цели' },
  { id: 'budget', icon: '◫', label: 'Бюджет' },
  { id: 'meals', icon: '♨', label: 'Меню' },
  { id: 'settings', icon: '⚙', label: 'Настройки' },
]

export default function App() {
  const [data, setData] = useLocalStore()
  const cloud = useCloudSync(data, setData)
  const [tab, setTab] = useState<Tab>('home')
  const [adding, setAdding] = useState(false)

  const stats = useMemo(() => {
    const target = data.goals.reduce((sum, goal) => sum + goal.target, 0)
    const saved = data.goals.reduce((sum, goal) => sum + goal.saved, 0)
    const purchaseTotal = data.purchases.filter((item) => !item.done).reduce((sum, item) => sum + item.amount, 0)
    const expenses = data.transactions.filter((item) => item.type === 'expense' && item.date.startsWith(monthKey)).reduce((sum, item) => sum + item.amount, 0)
    const planned = data.budget.reduce((sum, item) => sum + item.planned, 0)
    return { target, saved, purchaseTotal, expenses, planned }
  }, [data])

  function update(next: Partial<AppData>) { setData((old) => ({ ...old, ...next })) }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">♥</span><span>до 23 июля</span></div>
      <nav>{nav.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="side-status"><span className={cloud.household ? 'dot online' : 'dot'} />{cloud.household ? cloud.household.name : 'Локальный режим'}</div>
    </aside>

    <main>
      <header className="topbar">
        <div><p className="eyebrow">НАШ ОБЩИЙ ПЛАН</p><h1>{nav.find((item) => item.id === tab)?.label}</h1></div>
        <button className="primary compact" onClick={() => setAdding(true)}>＋ Добавить</button>
      </header>

      {tab === 'home' && <Dashboard data={data} stats={stats} setTab={setTab} />}
      {tab === 'plans' && <Plans data={data} update={update} />}
      {tab === 'budget' && <Budget data={data} update={update} />}
      {tab === 'meals' && <Meals data={data} update={update} />}
      {tab === 'settings' && <Settings data={data} update={update} cloud={cloud} />}
    </main>

    <nav className="mobile-nav">{nav.slice(0, 4).map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
    {adding && <TransactionModal data={data} onClose={() => setAdding(false)} onSave={(transaction, goalId) => {
      setData((old) => ({
        ...old,
        transactions: [transaction, ...old.transactions],
        goals: transaction.type === 'saving' ? old.goals.map((goal) => goal.id === goalId ? { ...goal, saved: goal.saved + transaction.amount } : goal) : old.goals,
      }))
      setAdding(false)
    }} />}
  </div>
}

function Dashboard({ data, stats, setTab }: { data: AppData; stats: { target: number; saved: number; purchaseTotal: number; expenses: number; planned: number }; setTab: (tab: Tab) => void }) {
  const mainGoal = data.goals[0]
  const progress = stats.target ? Math.min(100, stats.saved / stats.target * 100) : 0
  const monthly = data.goals.reduce((sum, goal) => sum + Math.max(0, goal.target - goal.saved) / monthsLeft(goal.deadline), 0)
  return <div className="page-grid">
    <section className="hero-card">
      <div><p className="eyebrow light">ДО НАШЕГО ДНЯ</p><strong>{daysLeft(data.weddingDate)}</strong><span>дней</span><p>23 июля 2027 • свадьба</p></div>
      <div className="rings">◯<i>◯</i></div>
    </section>

    <section className="goal-card card span-2">
      <div className="section-head"><div><p className="eyebrow">ГЛАВНАЯ ЦЕЛЬ</p><h2>{mainGoal?.emoji} {mainGoal?.name ?? 'Добавьте цель'}</h2></div><button className="link" onClick={() => setTab('plans')}>Все цели →</button></div>
      <div className="goal-numbers"><strong>{money(stats.saved)}</strong><span>из {money(stats.target)}</span><b>{Math.round(progress)}%</b></div>
      <div className="progress"><i style={{ width: `${progress}%` }} /></div>
      <div className="goal-tip"><span>Чтобы успеть вовремя</span><strong>{money(monthly)} <small>/ месяц</small></strong></div>
    </section>

    <section className="card metric"><span className="metric-icon sand">↗</span><p>План расходов</p><strong>{money(stats.planned)}</strong><small>на текущий месяц</small></section>
    <section className="card metric"><span className="metric-icon green">✓</span><p>Потрачено</p><strong>{money(stats.expenses)}</strong><small>{stats.planned ? Math.round(stats.expenses / stats.planned * 100) : 0}% месячного плана</small></section>
    <section className="card metric"><span className="metric-icon rose">◇</span><p>Будущие покупки</p><strong>{money(stats.purchaseTotal)}</strong><small>{data.purchases.filter((item) => !item.done).length} пунктов в плане</small></section>

    <section className="card span-2">
      <div className="section-head"><div><p className="eyebrow">БЛИЖАЙШИЕ ПОКУПКИ</p><h2>Ничего не забыть</h2></div><button className="link" onClick={() => setTab('plans')}>Открыть план →</button></div>
      <div className="purchase-list">{data.purchases.filter((item) => !item.done).slice(0, 4).map((item) => <div key={item.id}><span className={`priority ${item.priority === 'Обязательно' ? 'must' : ''}`} /> <b>{item.name}</b><small>{dateText(item.due)}</small><strong>{item.amount ? money(item.amount) : 'оценить'}</strong></div>)}</div>
    </section>

    <section className="card">
      <p className="eyebrow">ЭТА НЕДЕЛЯ</p><h2>Меню</h2>
      <div className="meal-preview">{data.meals.slice(0, 4).map((meal) => <div key={meal.day}><b>{meal.day.slice(0, 2)}</b><span>{meal.dish || 'не запланировано'}</span></div>)}</div>
      <button className="secondary full" onClick={() => setTab('meals')}>Спланировать меню</button>
    </section>
  </div>
}

function Plans({ data, update }: { data: AppData; update: (data: Partial<AppData>) => void }) {
  const [goalName, setGoalName] = useState('')
  const [purchaseName, setPurchaseName] = useState('')
  return <div className="stack">
    <section className="card"><div className="section-head"><div><p className="eyebrow">НАКОПЛЕНИЯ</p><h2>Наши цели</h2></div></div>
      <div className="goal-grid">{data.goals.map((goal) => <article className="mini-goal" key={goal.id}><span>{goal.emoji}</span><div><h3>{goal.name}</h3><p>{money(goal.saved)} из {money(goal.target)}</p><div className="progress"><i style={{ width: `${Math.min(100, goal.saved / goal.target * 100)}%` }} /></div><small>до {dateText(goal.deadline)} · {money(Math.max(0, goal.target - goal.saved) / monthsLeft(goal.deadline))}/мес.</small></div><button className="icon-btn" onClick={() => update({ goals: data.goals.filter((x) => x.id !== goal.id) })}>×</button></article>)}</div>
      <form className="quick-form" onSubmit={(event) => { event.preventDefault(); if (!goalName) return; const goal: Goal = { id: crypto.randomUUID(), name: goalName, target: 0, saved: 0, deadline: data.weddingDate, emoji: '🎯' }; update({ goals: [...data.goals, goal] }); setGoalName('') }}><input placeholder="Новая цель" value={goalName} onChange={(e) => setGoalName(e.target.value)} /><button className="secondary">Добавить цель</button></form>
    </section>

    <section className="card"><div className="section-head"><div><p className="eyebrow">ПЛАН ПОКУПОК</p><h2>До свадьбы</h2></div><strong>{money(data.purchases.reduce((sum, item) => sum + item.amount, 0))}</strong></div>
      <div className="table-list">{data.purchases.map((item) => <div className={item.done ? 'done' : ''} key={item.id}><input type="checkbox" checked={item.done} onChange={() => update({ purchases: data.purchases.map((x) => x.id === item.id ? { ...x, done: !x.done } : x) })} /><input className="bare grow" value={item.name} onChange={(e) => update({ purchases: data.purchases.map((x) => x.id === item.id ? { ...x, name: e.target.value } : x) })} /><select className="bare" value={item.priority} onChange={(e) => update({ purchases: data.purchases.map((x) => x.id === item.id ? { ...x, priority: e.target.value as Purchase['priority'] } : x) })}><option>Обязательно</option><option>Желательно</option><option>Можно позже</option></select><input className="bare amount" type="number" min="0" value={item.amount || ''} placeholder="0 ₽" onChange={(e) => update({ purchases: data.purchases.map((x) => x.id === item.id ? { ...x, amount: Number(e.target.value) } : x) })} /><button className="icon-btn" onClick={() => update({ purchases: data.purchases.filter((x) => x.id !== item.id) })}>×</button></div>)}</div>
      <form className="quick-form" onSubmit={(event) => { event.preventDefault(); if (!purchaseName) return; update({ purchases: [...data.purchases, { id: crypto.randomUUID(), name: purchaseName, amount: 0, due: data.weddingDate, priority: 'Желательно', done: false }] }); setPurchaseName('') }}><input placeholder="Что нужно купить?" value={purchaseName} onChange={(e) => setPurchaseName(e.target.value)} /><button className="secondary">Добавить покупку</button></form>
    </section>
  </div>
}

function Budget({ data, update }: { data: AppData; update: (data: Partial<AppData>) => void }) {
  const expenses = data.transactions.filter((item) => item.type === 'expense' && item.date.startsWith(monthKey))
  return <div className="stack">
    <section className="card"><p className="eyebrow">ПЛАН НА МЕСЯЦ</p><h2>Лимиты по категориям</h2><div className="budget-list">{data.budget.map((item) => { const actual = expenses.filter((x) => x.category === item.name).reduce((sum, x) => sum + x.amount, 0); return <div key={item.id}><i style={{ background: item.color }} /><span>{item.name}</span><div className="progress"><i style={{ width: `${Math.min(100, actual / item.planned * 100)}%`, background: item.color }} /></div><small>{money(actual)} /</small><input type="number" value={item.planned} onChange={(e) => update({ budget: data.budget.map((x) => x.id === item.id ? { ...x, planned: Number(e.target.value) } : x) })} /></div> })}</div></section>
    <section className="card"><div className="section-head"><div><p className="eyebrow">ОПЕРАЦИИ</p><h2>Последние записи</h2></div></div><div className="transactions">{data.transactions.length ? data.transactions.map((item) => <div key={item.id}><span className={`transaction-icon ${item.type}`}>{item.type === 'income' ? '＋' : item.type === 'saving' ? '♥' : '−'}</span><div><b>{item.note || item.category}</b><small>{dateText(item.date)} · {item.category}</small></div><strong className={item.type}>{item.type === 'expense' ? '−' : '+'}{money(item.amount)}</strong></div>) : <div className="empty">Пока нет операций. Нажмите «Добавить».</div>}</div></section>
  </div>
}

function Meals({ data, update }: { data: AppData; update: (data: Partial<AppData>) => void }) {
  const total = data.meals.reduce((sum, item) => sum + item.cost, 0)
  return <section className="card meal-page"><div className="section-head"><div><p className="eyebrow">МЕНЮ И ПРОДУКТЫ</p><h2>Неделя без спонтанных трат</h2></div><div><small>Оценка недели</small><strong>{money(total)}</strong></div></div><p className="muted">Запишите главное блюдо или общий план дня и примерную стоимость продуктов.</p><div className="week-grid">{data.meals.map((meal, index) => <article key={meal.day}><b>{meal.day}</b><textarea rows={3} value={meal.dish} placeholder="Например: паста, салат" onChange={(e) => update({ meals: data.meals.map((x, i) => i === index ? { ...x, dish: e.target.value } : x) })} /><label>Продукты, ₽<input type="number" min="0" value={meal.cost || ''} onChange={(e) => update({ meals: data.meals.map((x, i) => i === index ? { ...x, cost: Number(e.target.value) } : x) })} /></label></article>)}</div></section>
}

type CloudShape = ReturnType<typeof useCloudSync>
function Settings({ data, update, cloud }: { data: AppData; update: (data: Partial<AppData>) => void; cloud: CloudShape }) {
  const [joinCode, setJoinCode] = useState(''); const [familyName, setFamilyName] = useState('Наша семья')
  return <div className="stack settings-grid">
    <section className="card"><p className="eyebrow">ВАЖНАЯ ДАТА</p><h2>Дата свадьбы</h2><label className="field">Дата<input type="date" value={data.weddingDate} onChange={(e) => update({ weddingDate: e.target.value })} /></label></section>
    <section className="card"><p className="eyebrow">ОБЩИЙ ДОСТУП</p><h2>{cloud.household ? 'Синхронизация включена' : 'Подключить второй телефон'}</h2>
      {!telegramCloudEnabled && <div className="notice"><b>Сейчас локальный режим</b><span>После подключения бота и серверной функции откройте приложение из Telegram — вход произойдёт автоматически.</span></div>}
      {telegramCloudEnabled && cloud.user && !cloud.household && <div className="cloud-setup"><div><h3>Создать общий бюджет</h3><input value={familyName} onChange={(e) => setFamilyName(e.target.value)} /><button className="primary" onClick={() => void cloud.createHousehold(familyName)}>Создать</button></div><span>или</span><div><h3>Присоединиться</h3><input maxLength={6} placeholder="Код семьи" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} /><button className="secondary" onClick={() => void cloud.joinHousehold(joinCode)}>Войти по коду</button></div></div>}
      {cloud.household && <div className="invite"><div><small>Код для партнёра</small><strong>{cloud.household.invite_code}</strong></div><p>Невеста открывает Mini App в своём Telegram и вводит этот код. Сейчас вы вошли как {cloud.user?.first_name}.</p></div>}
      {cloud.message && <p className="error">{cloud.message}</p>}
    </section>
  </div>
}

function TransactionModal({ data, onClose, onSave }: { data: AppData; onClose: () => void; onSave: (transaction: Transaction, goalId?: string) => void }) {
  const [type, setType] = useState<Transaction['type']>('expense'); const [amount, setAmount] = useState(''); const [category, setCategory] = useState(data.budget[0]?.name ?? 'Другое'); const [note, setNote] = useState(''); const [goalId, setGoalId] = useState(data.goals[0]?.id)
  function submit(event: FormEvent) { event.preventDefault(); if (!Number(amount)) return; onSave({ id: crypto.randomUUID(), type, amount: Number(amount), category: type === 'saving' ? data.goals.find((x) => x.id === goalId)?.name ?? 'Накопления' : category, note, date: new Date().toISOString().slice(0, 10) }, goalId) }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}><div className="section-head"><h2>Новая запись</h2><button type="button" className="icon-btn" onClick={onClose}>×</button></div><div className="segmented">{(['expense','income','saving'] as const).map((x) => <button type="button" className={type === x ? 'active' : ''} onClick={() => setType(x)} key={x}>{x === 'expense' ? 'Расход' : x === 'income' ? 'Доход' : 'Отложили'}</button>)}</div><label className="field">Сумма<input autoFocus type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0 ₽" /></label>{type === 'saving' ? <label className="field">Цель<select value={goalId} onChange={(e) => setGoalId(e.target.value)}>{data.goals.map((goal) => <option value={goal.id} key={goal.id}>{goal.name}</option>)}</select></label> : <label className="field">Категория<select value={category} onChange={(e) => setCategory(e.target.value)}>{data.budget.map((item) => <option key={item.id}>{item.name}</option>)}<option>Другое</option></select></label>}<label className="field">Комментарий<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="На что или откуда деньги" /></label><button className="primary full">Сохранить</button></form></div>
}

