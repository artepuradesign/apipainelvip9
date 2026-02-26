import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { pdfRgService, PdfRgPedido } from '@/services/pdfRgService';
import { Search, Eye, Trash2, RefreshCw, Download, Loader2, Upload, Package, DollarSign, Truck, CheckCircle } from 'lucide-react';
import PageHeaderCard from '@/components/dashboard/PageHeaderCard';
import { getFullApiUrl } from '@/utils/apiHelper';
import { cookieUtils } from '@/utils/cookieUtils';

const statusLabels: Record<number, string> = {
  1: 'Pedido Realizado',
  2: 'Pagamento Confirmado',
  3: 'Pedido Enviado',
  4: 'Pedido Entregue',
};

const statusIcons: Record<number, React.ReactNode> = {
  1: <Package className="h-5 w-5" />,
  2: <DollarSign className="h-5 w-5" />,
  3: <Truck className="h-5 w-5" />,
  4: <CheckCircle className="h-5 w-5" />,
};

const statusColors: Record<number, string> = {
  1: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  2: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  3: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  4: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
};

const formatDateBR = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

// Progress bar component
const StatusProgressBar = ({ currentStatus }: { currentStatus: number }) => {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Line connecting steps */}
        <div className="absolute top-5 left-[12%] right-[12%] h-1 bg-muted rounded-full" />
        <div
          className="absolute top-5 left-[12%] h-1 bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.max(0, ((currentStatus - 1) / 3) * 76)}%` }}
        />

        {[1, 2, 3, 4].map((step) => {
          const isActive = step <= currentStatus;
          const isCurrent = step === currentStatus;
          return (
            <div key={step} className="flex flex-col items-center z-10 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'bg-muted text-muted-foreground'
                } ${isCurrent ? 'ring-4 ring-primary/30 scale-110' : ''}`}
              >
                {statusIcons[step]}
              </div>
              <span className={`text-[10px] mt-2 text-center leading-tight max-w-[80px] ${
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
              }`}>
                {statusLabels[step]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AdminPedidos = () => {
  const [pedidos, setPedidos] = useState<PdfRgPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPedido, setSelectedPedido] = useState<PdfRgPedido | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setPdfFile(null);
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

  const sendNotification = async (userId: number | null, pedidoId: number, newStatus: number) => {
    if (!userId) return;
    try {
      const token = cookieUtils.get('session_token') || cookieUtils.get('api_session_token');
      await fetch(getFullApiUrl('/notifications'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: userId,
          type: 'pedido_status',
          title: `Pedido #${pedidoId} - ${statusLabels[newStatus]}`,
          message: `Seu pedido #${pedidoId} teve o status atualizado para: ${statusLabels[newStatus]}.${newStatus === 4 ? ' O arquivo PDF está disponível para download.' : ''}`,
          priority: newStatus === 4 ? 'high' : 'medium',
        }),
      });
    } catch (e) {
      console.error('Erro ao enviar notificação:', e);
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });

  const handleUpdateStatus = async (newStatus: number) => {
    if (!selectedPedido) return;

    // Status 4 requires PDF upload
    if (newStatus === 4 && !pdfFile && !selectedPedido.pdf_entrega_base64) {
      toast.error('É obrigatório enviar o arquivo PDF para marcar como Entregue.');
      return;
    }

    setUpdatingStatus(true);
    try {
      const extraData: any = {};

      if (pdfFile) {
        const base64 = await fileToBase64(pdfFile);
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        const fileName = `${selectedPedido.user_id || 0}_${selectedPedido.cpf}_${dateStr}.pdf`;
        extraData.pdf_entrega_base64 = base64;
        extraData.pdf_entrega_nome = fileName;
      }

      const res = await pdfRgService.atualizarStatus(selectedPedido.id, newStatus, Object.keys(extraData).length > 0 ? extraData : undefined);
      if (res.success) {
        toast.success(`Status atualizado para: ${statusLabels[newStatus]}`);
        
        // Send notification to user
        await sendNotification(selectedPedido.user_id, selectedPedido.id, newStatus);
        
        loadPedidos();
        setSelectedPedido(prev => prev ? { ...prev, status: newStatus, ...(extraData.pdf_entrega_nome ? { pdf_entrega_nome: extraData.pdf_entrega_nome } : {}) } : null);
        setPdfFile(null);
      } else {
        toast.error(res.error || 'Erro ao atualizar status');
      }
    } catch (e) {
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdatingStatus(false);
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

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são permitidos');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 20MB)');
      return;
    }
    setPdfFile(file);
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
            <SelectItem value="1">Pedido Realizado</SelectItem>
            <SelectItem value="2">Pagamento Confirmado</SelectItem>
            <SelectItem value="3">Pedido Enviado</SelectItem>
            <SelectItem value="4">Pedido Entregue</SelectItem>
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
      <Dialog open={!!selectedPedido} onOpenChange={() => { setSelectedPedido(null); setPdfFile(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{selectedPedido?.id}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : selectedPedido && (
            <div className="space-y-5">
              {/* Status Progress Bar */}
              <StatusProgressBar currentStatus={selectedPedido.status} />

              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">CPF:</span> {selectedPedido.cpf}</div>
                <div><span className="text-muted-foreground">Nome:</span> {selectedPedido.nome || '—'}</div>
                <div><span className="text-muted-foreground">Nascimento:</span> {formatDateBR(selectedPedido.dt_nascimento)}</div>
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

              {/* PDF Upload for delivery */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Enviar PDF de Entrega
                  {selectedPedido.status < 4 && <span className="text-xs text-destructive">(obrigatório para Entregue)</span>}
                </Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfChange}
                  className="cursor-pointer"
                />
                {pdfFile && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> {pdfFile.name}
                  </p>
                )}
                {selectedPedido.pdf_entrega_nome && !pdfFile && (
                  <p className="text-xs text-muted-foreground">
                    PDF já enviado: <strong>{selectedPedido.pdf_entrega_nome}</strong>
                  </p>
                )}
              </div>

              {/* Status Slider */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Atualizar Status:</p>
                
                {/* Interactive status steps */}
                <div className="flex items-center gap-0">
                  {[1, 2, 3, 4].map((step) => {
                    const isActive = step <= selectedPedido.status;
                    const canClick = step !== selectedPedido.status;
                    const isEntregue = step === 4;
                    const needsPdf = isEntregue && !pdfFile && !selectedPedido.pdf_entrega_base64;

                    return (
                      <React.Fragment key={step}>
                        <button
                          onClick={() => canClick && handleUpdateStatus(step)}
                          disabled={updatingStatus || !canClick}
                          className={`flex-1 py-3 px-2 text-xs font-medium rounded-md transition-all duration-200 border ${
                            isActive
                              ? 'bg-primary text-primary-foreground border-primary shadow-md'
                              : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                          } ${canClick ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'} ${
                            needsPdf ? 'opacity-50' : ''
                          }`}
                          title={needsPdf ? 'Envie o PDF primeiro' : statusLabels[step]}
                        >
                          <div className="flex flex-col items-center gap-1">
                            {statusIcons[step]}
                            <span className="leading-tight">{statusLabels[step]}</span>
                          </div>
                        </button>
                        {step < 4 && <div className={`w-2 h-0.5 ${step < selectedPedido.status ? 'bg-primary' : 'bg-muted'}`} />}
                      </React.Fragment>
                    );
                  })}
                </div>

                {updatingStatus && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Atualizando...
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPedidos;
