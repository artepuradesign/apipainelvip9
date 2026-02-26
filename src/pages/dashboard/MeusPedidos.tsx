import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { pdfRgService, PdfRgPedido, PdfRgStatus } from '@/services/pdfRgService';
import { Eye, Download, Loader2, Package, DollarSign, Hammer, CheckCircle, ClipboardList, Upload, FileDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';
import { useNavigate } from 'react-router-dom';

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

const statusBadgeColors: Record<PdfRgStatus, string> = {
  realizado: 'bg-emerald-500 text-white',
  pagamento_confirmado: 'bg-emerald-500 text-white',
  em_confeccao: 'bg-blue-500 text-white',
  entregue: 'bg-emerald-500 text-white',
};

const formatDateBR = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const formatFullDate = (dateString: string | null) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

const StatusTracker = ({ pedido }: { pedido: PdfRgPedido }) => {
  const currentIdx = getStatusIndex(pedido.status);

  return (
    <div className="w-full py-6 px-2">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-5 left-[12%] right-[12%] h-1 bg-muted rounded-full" />
        <div
          className="absolute top-5 left-[12%] h-1 rounded-full transition-all duration-700 ease-out bg-emerald-500"
          style={{ width: `${Math.max(0, (currentIdx / 3) * 76)}%` }}
        />

        {STATUS_ORDER.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isActive = idx <= currentIdx;
          const isEmConfeccao = step === 'em_confeccao' && isCurrent;
          const timestamp = getStepTimestamp(pedido, step);

          return (
            <div key={step} className="flex flex-col items-center z-10 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                  isCompleted || (isCurrent && step === 'entregue')
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : isEmConfeccao
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-pulse'
                    : isCurrent
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-muted text-muted-foreground'
                } ${isCurrent ? 'ring-4 ring-emerald-500/20 scale-110' : ''}`}
              >
                {isCompleted ? <CheckCircle className="h-5 w-5" /> : statusIcons[step]}
              </div>
              <span className={`text-[10px] sm:text-xs mt-2 text-center leading-tight max-w-[80px] ${
                isActive ? (isEmConfeccao ? 'text-blue-600 font-semibold' : 'text-emerald-600 font-semibold') : 'text-muted-foreground'
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

const MeusPedidos = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<PdfRgPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState<PdfRgPedido | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadPedidos = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await pdfRgService.listar({ limit: 50, user_id: Number(user.id) });
      if (res.success && res.data) {
        setPedidos(res.data.data || []);
      }
    } catch {
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  const handleView = async (pedido: PdfRgPedido) => {
    try {
      const res = await pdfRgService.obter(pedido.id);
      if (res.success && res.data) {
        setSelectedPedido(res.data);
        setShowModal(true);
      }
    } catch {
      toast.error('Erro ao carregar detalhes');
    }
  };

  const handleDownload = (pedido: PdfRgPedido) => {
    if (!pedido.pdf_entrega_base64 || !pedido.pdf_entrega_nome) {
      toast.error('PDF ainda não disponível');
      return;
    }
    const link = document.createElement('a');
    link.href = pedido.pdf_entrega_base64;
    link.download = pedido.pdf_entrega_nome;
    link.click();
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-5xl mx-auto">
      <SimpleTitleBar
        title="Meus Pedidos"
        subtitle="Acompanhe o status dos seus pedidos de PDF RG"
        onBack={() => navigate('/dashboard')}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pedidos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <ClipboardList className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Você ainda não possui pedidos.</p>
            <Button onClick={() => navigate('/dashboard/pdf-rg')}>Fazer um Pedido</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pedidos.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm">Pedido #{p.id}</span>
                    <Badge className={statusBadgeColors[p.status] || 'bg-muted'}>
                      {statusLabels[p.status] || p.status}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatFullDate(p.created_at)}
                  </span>
                </div>

                {/* Progress tracker */}
                <StatusTracker pedido={p} />

                {/* Info & Actions - responsive */}
                <div className="px-4 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm text-muted-foreground grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1">
                    <p>CPF: <span className="font-mono text-foreground">{p.cpf}</span></p>
                    {p.nome && <p>Nome: <span className="text-foreground">{p.nome}</span></p>}
                    <p>Valor: <span className="text-foreground font-medium">R$ {Number(p.preco_pago || 0).toFixed(2)}</span></p>
                    {p.dt_nascimento && <p className="hidden md:block">Nascimento: <span className="text-foreground">{formatDateBR(p.dt_nascimento)}</span></p>}
                    {p.naturalidade && <p className="hidden md:block">Naturalidade: <span className="text-foreground">{p.naturalidade}</span></p>}
                    {p.diretor && <p className="hidden md:block">Diretor: <span className="text-foreground">{p.diretor}</span></p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleView(p)}>
                      <Eye className="h-4 w-4 mr-1" /> Detalhes
                    </Button>
                    {p.status === 'entregue' && p.pdf_entrega_nome && (
                      <Button
                        size="icon"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 w-8"
                        onClick={() => handleDownload(p)}
                        title="Baixar PDF"
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{selectedPedido?.id}</DialogTitle>
            <DialogDescription>Detalhes do pedido</DialogDescription>
          </DialogHeader>
          {selectedPedido && (
            <div className="space-y-4 text-sm">
              <StatusTracker pedido={selectedPedido} />

              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">CPF:</span><span className="font-mono">{selectedPedido.cpf}</span>
                {selectedPedido.nome && <><span className="text-muted-foreground">Nome:</span><span>{selectedPedido.nome}</span></>}
                {selectedPedido.dt_nascimento && <><span className="text-muted-foreground">Nascimento:</span><span>{formatDateBR(selectedPedido.dt_nascimento)}</span></>}
                {selectedPedido.naturalidade && <><span className="text-muted-foreground">Naturalidade:</span><span>{selectedPedido.naturalidade}</span></>}
                {selectedPedido.filiacao_mae && <><span className="text-muted-foreground">Mãe:</span><span>{selectedPedido.filiacao_mae}</span></>}
                {selectedPedido.filiacao_pai && <><span className="text-muted-foreground">Pai:</span><span>{selectedPedido.filiacao_pai}</span></>}
                {selectedPedido.diretor && <><span className="text-muted-foreground">Diretor:</span><span>{selectedPedido.diretor}</span></>}
                <span className="text-muted-foreground">QR Code:</span><span>{selectedPedido.qr_plan?.toUpperCase()}</span>
                <span className="text-muted-foreground">Valor:</span><span>R$ {Number(selectedPedido.preco_pago || 0).toFixed(2)}</span>
                <span className="text-muted-foreground">Data:</span><span>{formatFullDate(selectedPedido.created_at)}</span>
              </div>

              {(selectedPedido.anexo1_nome || selectedPedido.anexo2_nome || selectedPedido.anexo3_nome) && (
                <div>
                  <p className="text-muted-foreground mb-1">Anexos:</p>
                  <div className="flex flex-wrap gap-2">
                    {[selectedPedido.anexo1_nome, selectedPedido.anexo2_nome, selectedPedido.anexo3_nome].filter(Boolean).map((nome, i) => (
                      <Badge key={i} variant="secondary" className="text-xs"><Upload className="h-3 w-3 mr-1" />{nome}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedPedido.status === 'entregue' && selectedPedido.pdf_entrega_nome && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground mb-2">📄 PDF Entregue:</p>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleDownload(selectedPedido)}>
                    <Download className="h-4 w-4 mr-2" /> {selectedPedido.pdf_entrega_nome}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MeusPedidos;
