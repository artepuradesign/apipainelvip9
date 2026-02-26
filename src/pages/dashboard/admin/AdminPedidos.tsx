import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { pdfRgService, PdfRgPedido, PdfRgStatus } from '@/services/pdfRgService';
import { Search, Eye, Trash2, RefreshCw, Download, Loader2, Upload, Package, DollarSign, Hammer, CheckCircle, X } from 'lucide-react';
import PageHeaderCard from '@/components/dashboard/PageHeaderCard';
import { getFullApiUrl } from '@/utils/apiHelper';
import { cookieUtils } from '@/utils/cookieUtils';

const STATUS_ORDER: PdfRgStatus[] = ['realizado', 'pagamento_confirmado', 'em_confeccao', 'entregue'];

const statusLabels: Record<PdfRgStatus, string> = {
  realizado: 'Pedido Realizado',
  pagamento_confirmado: 'Pagamento Confirmado',
  em_confeccao: 'Em Confecção',
  entregue: 'Entregue',
};

const statusIcons: Record<PdfRgStatus, React.ReactNode> = {
  realizado: <Package className="h-5 w-5" />,
  pagamento_confirmado: <DollarSign className="h-5 w-5" />,
  em_confeccao: <Hammer className="h-5 w-5" />,
  entregue: <CheckCircle className="h-5 w-5" />,
};

const statusColors: Record<PdfRgStatus, string> = {
  realizado: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  pagamento_confirmado: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  em_confeccao: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  entregue: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
};

const formatDateBR = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const formatTime = (dateString: string | null) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const getStatusIndex = (status: PdfRgStatus) => STATUS_ORDER.indexOf(status);

const getStepTimestamp = (pedido: PdfRgPedido, step: PdfRgStatus): string | null => {
  const map: Record<PdfRgStatus, string | null> = {
    realizado: pedido.realizado_at,
    pagamento_confirmado: pedido.pagamento_confirmado_at,
    em_confeccao: pedido.em_confeccao_at,
    entregue: pedido.entregue_at,
  };
  return map[step];
};

// Circle-based progress bar for status display & update
const StatusProgressCircles = ({
  pedido,
  onClickStep,
  disabled,
}: {
  pedido: PdfRgPedido;
  onClickStep?: (step: PdfRgStatus) => void;
  disabled?: boolean;
}) => {
  const currentIdx = getStatusIndex(pedido.status);

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-5 left-[12%] right-[12%] h-1 bg-muted rounded-full" />
        <div
          className="absolute top-5 left-[12%] h-1 rounded-full transition-all duration-500 bg-emerald-500"
          style={{ width: `${Math.max(0, (currentIdx / 3) * 76)}%` }}
        />

        {STATUS_ORDER.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isActive = idx <= currentIdx;
          const isEmConfeccao = step === 'em_confeccao' && isCurrent;
          const canClick = onClickStep && step !== pedido.status && !disabled;
          const timestamp = getStepTimestamp(pedido, step);

          return (
            <div key={step} className="flex flex-col items-center z-10 flex-1">
              <button
                type="button"
                onClick={() => canClick && onClickStep?.(step)}
                disabled={!canClick}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted || (isCurrent && step === 'entregue')
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : isEmConfeccao
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse'
                    : isCurrent
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-muted text-muted-foreground'
                } ${isCurrent ? 'ring-4 ring-emerald-500/20 scale-110' : ''} ${
                  canClick ? 'cursor-pointer hover:scale-110' : 'cursor-default'
                }`}
              >
                {isCompleted ? <CheckCircle className="h-5 w-5" /> : statusIcons[step]}
              </button>
              <span className={`text-[10px] mt-2 text-center leading-tight max-w-[80px] ${
                isActive
                  ? (isEmConfeccao ? 'text-blue-600 font-semibold' : 'text-emerald-600 font-semibold')
                  : 'text-muted-foreground'
              }`}>
                {statusLabels[step]}
              </span>
              {timestamp && isActive && (
                <span className="text-[9px] text-muted-foreground mt-0.5">
                  {formatTime(timestamp)}
                </span>
              )}
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
  const [deletingPdf, setDeletingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
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

  const sendNotification = async (userId: number | null, pedidoId: number, newStatus: PdfRgStatus) => {
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
          message: `Seu pedido #${pedidoId} teve o status atualizado para: ${statusLabels[newStatus]}.${newStatus === 'entregue' ? ' O arquivo PDF está disponível para download.' : ''}`,
          priority: newStatus === 'entregue' ? 'high' : 'medium',
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

  const handleUpdateStatus = async (newStatus: PdfRgStatus) => {
    if (!selectedPedido) return;

    // Entregue requires PDF upload
    if (newStatus === 'entregue' && !pdfFile && !selectedPedido.pdf_entrega_base64) {
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
        await sendNotification(selectedPedido.user_id, selectedPedido.id, newStatus);
        loadPedidos();
        // Re-fetch full detail to get updated timestamps
        const detail = await pdfRgService.obter(selectedPedido.id);
        if (detail.success && detail.data) {
          setSelectedPedido(detail.data);
        }
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

  const handleDeletePdf = async () => {
    if (!selectedPedido) return;
    if (!confirm('Tem certeza que deseja apagar o PDF enviado?')) return;
    setDeletingPdf(true);
    try {
      const res = await pdfRgService.deletarPdf(selectedPedido.id);
      if (res.success) {
        toast.success('PDF apagado com sucesso');
        setSelectedPedido(prev => prev ? { ...prev, pdf_entrega_base64: null, pdf_entrega_nome: null } : null);
        loadPedidos();
      } else {
        toast.error(res.error || 'Erro ao apagar PDF');
      }
    } catch {
      toast.error('Erro ao apagar PDF');
    } finally {
      setDeletingPdf(false);
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
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="realizado">Pedido Realizado</SelectItem>
            <SelectItem value="pagamento_confirmado">Pagamento Confirmado</SelectItem>
            <SelectItem value="em_confeccao">Em Confecção</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
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
                      <Badge variant="outline" className={statusColors[p.status] || ''}>
                        {statusLabels[p.status] || p.status}
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
              {/* Status Progress - display */}
              <StatusProgressCircles pedido={selectedPedido} />

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
                  <Badge variant="outline" className={statusColors[selectedPedido.status] || ''}>
                    {statusLabels[selectedPedido.status] || selectedPedido.status}
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
                  {selectedPedido.status !== 'entregue' && <span className="text-xs text-destructive">(obrigatório para Entregue)</span>}
                </Label>

                {/* Existing PDF with delete option */}
                {selectedPedido.pdf_entrega_nome && !pdfFile && (
                  <div className="flex items-center justify-between bg-background rounded-md p-2 border">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                      PDF enviado: <strong>{selectedPedido.pdf_entrega_nome}</strong>
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={handleDeletePdf}
                      disabled={deletingPdf}
                      title="Apagar PDF"
                    >
                      {deletingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                    </Button>
                  </div>
                )}

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
              </div>

              {/* Status Update - Circle model */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Atualizar Status:</p>
                <p className="text-xs text-muted-foreground">Clique em uma etapa para atualizar o status do pedido.</p>
                <StatusProgressCircles
                  pedido={selectedPedido}
                  onClickStep={handleUpdateStatus}
                  disabled={updatingStatus}
                />

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
