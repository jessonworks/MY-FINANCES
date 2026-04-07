import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CheckCircle2, 
  Circle, 
  X, 
  ArrowUpCircle, 
  ArrowDownCircle,
  AlertCircle,
  Briefcase,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { cn, formatCurrency } from './lib/utils';

type TransactionType = 'PF' | 'PJ';
type Category = 'entrada' | 'saida' | 'divida';
type Status = 'pago' | 'pendente';

interface Transaction {
  id: string;
  descricao: string;
  valor: number;
  tipo: TransactionType;
  categoria: Category;
  status: Status;
  created_at: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TransactionType>('PF');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    categoria: 'entrada' as Category,
    status: 'pago' as Status,
  });

  const GOAL = 10000;

  useEffect(() => {
    fetchTransactions();
    
    // Real-time subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transacoes' },
        () => fetchTransactions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchTransactions() {
    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Erro ao buscar transações:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.tipo === activeTab);
  }, [transactions, activeTab]);

  const stats = useMemo(() => {
    const current = transactions.filter(t => t.tipo === activeTab);
    const entradas = current
      .filter(t => t.categoria === 'entrada')
      .reduce((acc, t) => acc + Number(t.valor), 0);
    const saidas = current
      .filter(t => t.categoria === 'saida')
      .reduce((acc, t) => acc + Number(t.valor), 0);
    const dividas = current
      .filter(t => t.categoria === 'divida' && t.status === 'pendente')
      .reduce((acc, t) => acc + Number(t.valor), 0);
    
    const lucro = entradas - saidas;
    const progress = Math.min((entradas / GOAL) * 100, 100);

    return { entradas, saidas, dividas, lucro, progress };
  }, [transactions, activeTab]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.descricao || !formData.valor) return;

    try {
      const { error } = await supabase.from('transacoes').insert([{
        descricao: formData.descricao,
        valor: Number(formData.valor),
        tipo: activeTab,
        categoria: formData.categoria,
        status: formData.categoria === 'divida' ? 'pendente' : 'pago',
      }]);

      if (error) throw error;
      
      setFormData({ descricao: '', valor: '', categoria: 'entrada', status: 'pago' });
      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao inserir transação:', err);
    }
  }

  async function toggleStatus(id: string, currentStatus: Status) {
    const newStatus = currentStatus === 'pago' ? 'pendente' : 'pago';
    try {
      const { error } = await supabase
        .from('transacoes')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 pb-24 md:p-8 max-w-2xl mx-auto font-sans">
      {/* Header & Toggle */}
      <header className="flex flex-col gap-6 mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Finanças Pro</h1>
          <div className="bg-zinc-900 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setActiveTab('PF')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium",
                activeTab === 'PF' ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <User size={16} /> PF
            </button>
            <button
              onClick={() => setActiveTab('PJ')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium",
                activeTab === 'PJ' ? "bg-zinc-800 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Briefcase size={16} /> PJ
            </button>
          </div>
        </div>

        {/* Dashboard Meta */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl"
        >
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-1">Meta de Lucro</p>
              <h2 className="text-3xl font-bold">{formatCurrency(stats.entradas)}</h2>
            </div>
            <p className="text-zinc-400 text-sm font-medium">Alvo: {formatCurrency(GOAL)}</p>
          </div>
          
          <div className="w-full bg-zinc-800 h-3 rounded-full overflow-hidden mb-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${stats.progress}%` }}
              className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
            />
          </div>
          <p className="text-zinc-500 text-xs text-right">{stats.progress.toFixed(1)}% concluído</p>
        </motion.div>

        {/* PF Calculator Alert */}
        {activeTab === 'PF' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900/50 border border-zinc-800/50 p-4 rounded-xl flex items-start gap-3"
          >
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <div className="text-sm">
              <p className="text-zinc-300 font-medium">Calculadora de Sobra</p>
              <p className="text-zinc-500 mt-1">
                Garantido: <span className="text-emerald-500">R$ 1.500</span> | 
                Custos: <span className="text-rose-500">R$ 1.300</span> | 
                Margem: <span className="text-amber-500 font-bold">R$ 200</span>
              </p>
            </div>
          </motion.div>
        )}
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-zinc-900/40 border border-zinc-800 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <TrendingUp size={16} />
            <span className="text-xs font-bold uppercase">Entradas</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(stats.entradas)}</p>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-rose-500 mb-2">
            <TrendingDown size={16} />
            <span className="text-xs font-bold uppercase">Saídas</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(stats.saidas)}</p>
        </div>
      </div>

      {/* Transactions List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wallet size={20} className="text-zinc-400" />
            Transações
          </h3>
          <span className="text-xs text-zinc-500 bg-zinc-900 px-2 py-1 rounded-md">
            {filteredTransactions.length} itens
          </span>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-zinc-600">Carregando...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-zinc-600 border-2 border-dashed border-zinc-900 rounded-2xl">
              Nenhuma transação encontrada.
            </div>
          ) : (
            filteredTransactions.map((t) => (
              <motion.div
                layout
                key={t.id}
                className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl",
                    t.categoria === 'entrada' ? "bg-emerald-500/10 text-emerald-500" : 
                    t.categoria === 'saida' ? "bg-rose-500/10 text-rose-500" : 
                    "bg-amber-500/10 text-amber-500"
                  )}>
                    {t.categoria === 'entrada' ? <ArrowUpCircle size={20} /> : 
                     t.categoria === 'saida' ? <ArrowDownCircle size={20} /> : 
                     <AlertCircle size={20} />}
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200">{t.descricao}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(t.created_at).toLocaleDateString('pt-BR')} • {t.categoria}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={cn(
                      "font-bold",
                      t.categoria === 'entrada' ? "text-emerald-500" : "text-zinc-200"
                    )}>
                      {t.categoria === 'saida' || t.categoria === 'divida' ? '-' : '+'} {formatCurrency(t.valor)}
                    </p>
                    {t.categoria === 'divida' && (
                      <span className={cn(
                        "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                        t.status === 'pago' ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500"
                      )}>
                        {t.status}
                      </span>
                    )}
                  </div>
                  
                  {t.categoria === 'divida' && (
                    <button
                      onClick={() => toggleStatus(t.id, t.status)}
                      className={cn(
                        "p-2 rounded-full transition-colors",
                        t.status === 'pago' ? "text-emerald-500" : "text-zinc-600 hover:text-zinc-400"
                      )}
                    >
                      {t.status === 'pago' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 bg-emerald-500 text-zinc-950 p-4 rounded-2xl shadow-[0_8px_30px_rgb(16,185,129,0.4)] hover:scale-110 active:scale-95 transition-all z-40"
      >
        <Plus size={32} strokeWidth={3} />
      </button>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Nova Transação ({activeTab})</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1.5 block">Descrição</label>
                  <input
                    autoFocus
                    type="text"
                    required
                    placeholder="Ex: Aluguel, Venda..."
                    className="w-full bg-zinc-800 border-zinc-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={formData.descricao}
                    onChange={e => setFormData({...formData, descricao: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1.5 block">Valor (R$)</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="0,00"
                    className="w-full bg-zinc-800 border-zinc-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={formData.valor}
                    onChange={e => setFormData({...formData, valor: e.target.value})}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase mb-1.5 block">Categoria</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['entrada', 'saida', 'divida'] as Category[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormData({...formData, categoria: cat})}
                        className={cn(
                          "py-2 rounded-lg text-xs font-bold uppercase transition-all border",
                          formData.categoria === cat 
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-500" 
                            : "bg-zinc-800 border-zinc-700 text-zinc-500"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-500 text-zinc-950 font-bold py-4 rounded-xl mt-4 hover:bg-emerald-400 transition-colors shadow-lg"
                >
                  Salvar Transação
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
