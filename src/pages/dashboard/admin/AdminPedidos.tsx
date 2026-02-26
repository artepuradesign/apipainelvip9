import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { pdfRgService, PdfRgPedido } from '@/services/pdfRgService';
import { Search, Eye, Trash2, RefreshCw, Download, Loader2 } from 'lucide-react';
import PageHeaderCard from '@/components/dashboard/PageHeaderCard';

const statusLabels: Record<number, string> = {
  1: 'Criado',
  2: 'Recebido',
  3: 'Em Confecção',
  4: 'Entregue',
};

const statusColors: Record<number, string> = {
  1: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  2: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  3: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  4: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
};

const AdminPedidos = () => {
  const [pedidos, setPedidos] = useState<PdfRgPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPedido, setSelectedPedido] = useState<PdfRgPedido | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const loadPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (statusFilter !== 'all') params.status = Number(statusFilter);
      if (search) params.search = search;

      const res = await pdfRgService.listar(params);
      if (res.success && res.data) {
        setPedidos(res.data.data);
        setTotal(res.data.pagination.total);
      }
    } catch (e) {
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  const handleViewDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await pdfRgService.obter(id);
      if (res.success && res.data) {
        setSelectedPedido(res.data);
      } else {
        toast.error('Erro ao carregar detalhes');
      }
    } catch (e) {
      toast.error('Erro ao carregar detalhes');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: number) => {
    try {
      const res = await pdfRgService.atualizarStatus(id, newStatus);
      if (res.success) {
        toast.success(`Status atualizado para: ${statusLabels[newStatus]}`);
        loadPedidos();
        if (selectedPedido?.id === id) {
          setSelectedPedido(prev => prev ? { ...prev, status: newStatus } : null);
        }
      } else {
        toast.error(res.error || 'Erro ao atualizar status');
      }
    } catch (e) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este pedido?')) return;
    try {
      const res = await pdfRgService.deletar(id);
      if (res.success) {
        toast.success('Pedido excluído');
        loadPedidos();
        if (selectedPedido?.id === id) setSelectedPedido(null);
      } else {
        toast.error(res.error || 'Erro ao excluir');
      }
    } catch (e) {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeaderCard
        title="Gerenciar Pedidos"
        subtitle="Visualize e gerencie todos os pedidos de PDF RG"
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por CPF ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="1">Criado</SelectItem>
            <SelectItem value="2">Recebido</SelectItem>
            <SelectItem value="3">Em Confecção</SelectItem>
            <SelectItem value="4">Entregue</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={loadPedidos}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pedidos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum pedido encontrado.</p>
          ) : (
            <div className="space-y-3">
              {pedidos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">#{p.id}</span>
                      <span className="text-sm">{p.cpf}</span>
                      {p.nome && <span className="text-sm text-muted-foreground">— {p.nome}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={statusColors[p.status]}>
                        {statusLabels[p.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleViewDetail(p.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedPedido} onOpenChange={() => setSelectedPedido(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{selectedPedido?.id}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : selectedPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">CPF:</span> {selectedPedido.cpf}</div>
                <div><span className="text-muted-foreground">Nome:</span> {selectedPedido.nome || '—'}</div>
                <div><span className="text-muted-foreground">Nascimento:</span> {selectedPedido.dt_nascimento || '—'}</div>
                <div><span className="text-muted-foreground">Naturalidade:</span> {selectedPedido.naturalidade || '—'}</div>
                <div><span className="text-muted-foreground">Mãe:</span> {selectedPedido.filiacao_mae || '—'}</div>
                <div><span className="text-muted-foreground">Pai:</span> {selectedPedido.filiacao_pai || '—'}</div>
                <div><span className="text-muted-foreground">Preço:</span> R$ {Number(selectedPedido.preco_pago || 0).toFixed(2)}</div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <Badge variant="outline" className={statusColors[selectedPedido.status]}>
                    {statusLabels[selectedPedido.status]}
                  </Badge>
                </div>
              </div>

              {/* Anexos */}
              <div>
                <p className="text-sm font-medium mb-2">Anexos:</p>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3].map(i => {
                    const nome = (selectedPedido as any)[`anexo${i}_nome`];
                    const base64 = (selectedPedido as any)[`anexo${i}_base64`];
                    if (!nome) return null;
                    return (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {base64 ? (
                          <a href={`data:application/octet-stream;base64,${base64}`} download={nome} className="flex items-center gap-1">
                            <Download className="h-3 w-3" /> {nome}
                          </a>
                        ) : nome}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Alterar Status */}
              <div>
                <p className="text-sm font-medium mb-2">Alterar Status:</p>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4].map(s => (
                    <Button
                      key={s}
                      size="sm"
                      variant={selectedPedido.status === s ? 'default' : 'outline'}
                      disabled={selectedPedido.status === s}
                      onClick={() => handleUpdateStatus(selectedPedido.id, s)}
                    >
                      {statusLabels[s]}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPedidos;
