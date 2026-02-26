import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { pdfRgService, PdfRgPedido } from '@/services/pdfRgService';
import { Eye, Download, Loader2, Package, DollarSign, Truck, CheckCircle, ClipboardList, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';
import { useNavigate } from 'react-router-dom';

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

const statusBadgeColors: Record<number, string> = {
  1: 'bg-blue-500 text-white',
  2: 'bg-amber-500 text-white',
  3: 'bg-purple-500 text-white',
  4: 'bg-emerald-500 text-white',
};

const formatDateBR = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const formatFullDate = (dateString: string) =>
  new Date(dateString).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Progress tracker like the reference image
const StatusTracker = ({ currentStatus }: { currentStatus: number }) => {
  return (
    <div className="w-full py-6 px-2">
      <div className="flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-5 left-[10%] right-[10%] h-1 bg-muted rounded-full" />
        {/* Active line */}
        <div
          className="absolute top-5 left-[10%] h-1 bg-primary rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.max(0, ((currentStatus - 1) / 3) * 80)}%` }}
        />

        {[1, 2, 3, 4].map((step) => {
          const isActive = step <= currentStatus;
          const isCurrent = step === currentStatus;
          return (
            <div key={step} className="flex flex-col items-center z-10 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                    : 'bg-muted text-muted-foreground'
                } ${isCurrent ? 'ring-4 ring-primary/20 scale-110' : ''}`}
              >
                {isActive ? <CheckCircle className="h-5 w-5" /> : statusIcons[step]}
              </div>
              <span className={`text-[10px] sm:text-xs mt-2 text-center leading-tight max-w-[80px] ${
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
    <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto">
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
                    <Badge className={statusBadgeColors[p.status]}>
                      {statusLabels[p.status]}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatFullDate(p.created_at)}
                  </span>
                </div>

                {/* Progress tracker */}
                <StatusTracker currentStatus={p.status} />

                {/* Info & Actions */}
                <div className="px-4 pb-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <p>CPF: <span className="font-mono">{p.cpf}</span></p>
                    {p.nome && <p>Nome: {p.nome}</p>}
                    <p>Valor: R$ {Number(p.preco_pago || 0).toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleView(p)}>
                      <Eye className="h-4 w-4 mr-1" /> Detalhes
                    </Button>
                    {p.status === 4 && p.pdf_entrega_nome && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleDownload(p)}>
                        <Download className="h-4 w-4 mr-1" /> Baixar PDF
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
              {/* Progress */}
              <StatusTracker currentStatus={selectedPedido.status} />

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

              {selectedPedido.status === 4 && selectedPedido.pdf_entrega_nome && (
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
