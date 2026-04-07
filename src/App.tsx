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
  User,
  Trash2,
  Search,
  Check,
  Edit2,
  ChevronDown,
  ChevronUp,
  Calendar
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
  const [searchTerm, setSearchTerm] = useState('');
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' }[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    categoria: 'entrada' as Category,
    status: 'pago' as Status,
  });

  const GOAL = 10000;

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }

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
    return transactions
      .filter(t => t.tipo === activeTab)
      .filter(t => t.descricao.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [transactions, activeTab, searchTerm]);

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
    const pendentesCount = current.filter(t => t.categoria === 'divida' && t.status === 'pendente').length;

    return { entradas, saidas, dividas, lucro, progress, pendentesCount };
  }, [transactions, activeTab]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.descricao || !formData.valor) {
      return;
    }

    const valorNum = parseFloat(formData.valor.replace(',', '.'));

    // Validação de negócio
    if (formData.categoria === 'entrada' && valorNum <= 0) {
      showToast('Entradas devem ter valor positivo', 'error');
      return;
    }
    if ((formData.categoria === 'saida' || formData.categoria === 'divida') && valorNum < 0) {
      showToast('Saídas/Dívidas não podem ter valor negativo', 'error');
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('transacoes')
          .update({
            descricao: formData.descricao,
            valor: valorNum,
            tipo: activeTab,
            categoria: formData.categoria,
            status: formData.categoria === 'divida' ? 'pendente' : 'pago',
          })
          .eq('id', editingId);

        if (error) throw error;
        showToast('Transação atualizada!');
      } else {
        const { error } = await supabase
          .from('transacoes')
          .insert([
            {
              descricao: formData.descricao,
              valor: valorNum,
              tipo: activeTab,
              categoria: formData.categoria,
              status: formData.categoria === 'divida' ? 'pendente' : 'pago',
            },
          ]);

        if (error) throw error;
        showToast('Transação salva com sucesso!');
      }
      
      // Limpa os estados após o envio com sucesso
      setFormData({ 
        descricao: '', 
        valor: '', 
        categoria: 'entrada', 
        status: 'pago' 
      });
      
      setIsModalOpen(false);
      setEditingId(null);
      
      // Recarrega a lista para garantir sincronia
      await fetchTransactions();
      
    } catch (err) {
      console.error('Erro ao salvar transação:', err);
      showToast('Erro ao salvar transação', 'error');
    }
  }

  function handleEdit(transaction: Transaction) {
    setEditingId(transaction.id);
    setFormData({
      descricao: transaction.descricao,
      valor: transaction.valor.toString(),
      categoria: transaction.categoria,
      status: transaction.status,
    });
    setIsModalOpen(true);
  }

  async function deleteTransaction(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;

    try {
      const { error } = await supabase
        .from('transacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Transação excluída');
      await fetchTransactions();
    } catch (err) {
      console.error('Erro ao excluir:', err);
      showToast('Erro ao excluir', 'error');
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
      showToast(newStatus === 'pago' ? 'Marcado como pago' : 'Marcado como pendente');
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      showToast('Erro ao atualizar status', 'error');
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 pb-24 md:p-8 max-w-2xl mx-auto font-sans">
      {/* Toasts */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-xs px-4">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "p-4 rounded-xl shadow-2xl border flex items-center gap-3",
                toast.type === 'success' ? "bg-zinc-900 border-emerald-500/50 text-emerald-500" : "bg-zinc-900 border-rose-500/50 text-rose-500"
              )}
            >
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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
      <div className="grid grid-cols-2 gap-4 mb-4">
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

      {/* Saldo Total Card */}
      <motion.div 
        key={stats.lucro + activeTab}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl mb-8 flex justify-between items-center"
      >
        <div>
          <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">Saldo Líquido ({activeTab})</p>
          <p className={cn(
            "text-2xl font-black",
            stats.lucro >= 0 ? "text-white" : "text-rose-500"
          )}>
            {formatCurrency(stats.lucro)}
          </p>
        </div>
        <div className={cn(
          "p-3 rounded-full",
          stats.lucro >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
        )}>
          <Wallet size={24} />
        </div>
      </motion.div>

      {/* Search Bar */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
        <input 
          type="text"
          placeholder="Buscar transação..."
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Gestão de Dívidas (Pendentes) */}
      {stats.pendentesCount > 0 && (
        <section className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-500">
              <AlertCircle size={20} />
              Dívidas Pendentes
            </h3>
            <span className="bg-amber-500/20 text-amber-500 text-xs font-bold px-2 py-1 rounded-full border border-amber-500/30">
              {stats.pendentesCount} {stats.pendentesCount === 1 ? 'pendente' : 'pendentes'}
            </span>
          </div>

          <div className="space-y-3">
            {filteredTransactions
              .filter(t => t.categoria === 'divida' && t.status === 'pendente')
              .map((t) => (
                <motion.div
                  layout
                  key={t.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200">{t.descricao}</p>
                      <p className="text-xs text-zinc-500">
                        {new Date(t.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <p className="font-bold text-amber-500">
                      {formatCurrency(t.valor)}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleStatus(t.id, t.status)}
                        className="p-2 rounded-full text-zinc-600 hover:text-emerald-500 transition-colors"
                        title="Marcar como pago"
                      >
                        <Circle size={24} />
                      </button>
                      <button
                        onClick={() => deleteTransaction(t.id)}
                        className="p-2 rounded-full text-zinc-600 hover:text-rose-500 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
          </div>
        </section>
      )}

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
            filteredTransactions
              .filter(t => t.categoria !== 'divida' || t.status === 'pago')
              .map((t) => (
                <motion.div
                layout
                key={t.id}
                onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-4 group cursor-pointer hover:border-zinc-700 transition-all"
              >
                <div className="flex items-center justify-between">
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
                        {new Date(t.created_at).toLocaleDateString('pt-BR')}
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
                    </div>
                    {expandedId === t.id ? <ChevronUp size={18} className="text-zinc-600" /> : <ChevronDown size={18} className="text-zinc-600" />}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === t.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-zinc-800 pt-4"
                    >
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <Calendar size={14} />
                          <span className="text-xs">{new Date(t.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500">
                          {t.tipo === 'PF' ? <User size={14} /> : <Briefcase size={14} />}
                          <span className="text-xs">Tipo: {t.tipo}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(t);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition-colors"
                        >
                          <Edit2 size={14} /> Editar
                        </button>
                        {t.categoria === 'divida' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatus(t.id, t.status);
                            }}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                              t.status === 'pago' ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-300"
                            )}
                          >
                            {t.status === 'pago' ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                            {t.status === 'pago' ? 'Pago' : 'Pendente'}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTransaction(t.id);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 text-xs font-bold hover:bg-rose-500/20 transition-colors"
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setEditingId(null);
          setFormData({ descricao: '', valor: '', categoria: 'entrada', status: 'pago' });
          setIsModalOpen(true);
        }}
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
              onClick={() => {
                setIsModalOpen(false);
                setEditingId(null);
              }}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{editingId ? 'Editar Transação' : 'Nova Transação'} ({activeTab})</h2>
                <button onClick={() => {
                  setIsModalOpen(false);
                  setEditingId(null);
                }} className="text-zinc-500 hover:text-white">
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
                  {editingId ? 'Atualizar Transação' : 'Salvar Transação'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
