import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2, AlertCircle, CheckCircle, Upload, Download, Eye, Package, Clock, Truck, PenTool, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { useApiModules } from '@/hooks/useApiModules';
import { useIsMobile } from '@/hooks/use-mobile';
import { getModulePrice } from '@/utils/modulePrice';
import { consultationApiService } from '@/services/consultationApiService';
import { walletApiService } from '@/services/walletApiService';
import { pdfRgService, type PdfRgPedido } from '@/services/pdfRgService';
import SimpleTitleBar from '@/components/dashboard/SimpleTitleBar';
import LoadingScreen from '@/components/layout/LoadingScreen';
import ScrollToTop from '@/components/ui/scroll-to-top';

const MODULE_TITLE = 'PDF RG';
const MODULE_ROUTE = '/dashboard/pdf-rg';

const DIRETORES = ['Maranhão', 'Piauí', 'Goiânia', 'Tocantins'] as const;
type DiretorPdfRg = (typeof DIRETORES)[number];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  realizado: { label: 'Pedido Realizado', color: 'bg-blue-500', icon: <Package className="h-3 w-3" /> },
  pagamento_confirmado: { label: 'Pagamento Confirmado', color: 'bg-emerald-500', icon: <CheckCircle className="h-3 w-3" /> },
  em_confeccao: { label: 'Em Confecção', color: 'bg-blue-500', icon: <Loader2 className="h-3 w-3" /> },
  entregue: { label: 'Entregue', color: 'bg-emerald-500', icon: <CheckCircle className="h-3 w-3" /> },
};

interface FormData {
  cpf: string;
  nome: string;
  dataNascimento: string;
  naturalidade: string;
  mae: string;
  pai: string;
  diretor: DiretorPdfRg | '';
  assinatura: File | null;
  foto: File | null;
  anexos: File[];
}

const PdfRg = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { modules } = useApiModules();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [formData, setFormData] = useState<FormData>({
    cpf: '', nome: '', dataNascimento: '', naturalidade: '',
    mae: '', pai: '', diretor: '', assinatura: null, foto: null, anexos: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [planBalance, setPlanBalance] = useState(0);
  const [modulePrice, setModulePrice] = useState(0);
  const [modulePriceLoading, setModulePriceLoading] = useState(true);
  const [balanceCheckLoading, setBalanceCheckLoading] = useState(true);
  const [qrPlan, setQrPlan] = useState<'1m' | '3m' | '6m'>('1m');

  const [meusPedidos, setMeusPedidos] = useState<PdfRgPedido[]>([]);
  const [pedidosLoading, setPedidosLoading] = useState(false);
  const [pedidoDetalhe, setPedidoDetalhe] = useState<PdfRgPedido | null>(null);
  const [showDetalheModal, setShowDetalheModal] = useState(false);

  const { balance, loadBalance: reloadApiBalance } = useWalletBalance();
  const {
    hasActiveSubscription, subscription, discountPercentage,
    calculateDiscountedPrice: calculateSubscriptionDiscount,
    isLoading: subscriptionLoading,
  } = useUserSubscription();

  const normalizeModuleRoute = useCallback((module: any): string => {
    const raw = (module?.api_endpoint || module?.path || '').toString().trim();
    if (!raw) return '';
    if (raw.startsWith('/')) return raw;
    if (raw.startsWith('dashboard/')) return `/${raw}`;
    if (!raw.includes('/')) return `/dashboard/${raw}`;
    return raw;
  }, []);

  const currentModule = useMemo(() => {
    const pathname = (location?.pathname || '').trim();
    if (!pathname) return null;
    return (modules || []).find((m: any) => normalizeModuleRoute(m) === pathname) || null;
  }, [modules, location?.pathname, normalizeModuleRoute]);

  const userPlan = hasActiveSubscription && subscription
    ? subscription.plan_name
    : (user ? localStorage.getItem(`user_plan_${user.id}`) || 'Pré-Pago' : 'Pré-Pago');

  const totalBalance = planBalance + walletBalance;
  const hasSufficientBalance = (price: number) => totalBalance >= price;

  const qrRoute = useMemo(() => {
    if (qrPlan === '3m') return '/dashboard/qrcode-rg-3m';
    if (qrPlan === '6m') return '/dashboard/qrcode-rg-6m';
    return '/dashboard/qrcode-rg-1m';
  }, [qrPlan]);

  const qrModule = useMemo(() => {
    return (modules || []).find((m: any) => normalizeModuleRoute(m) === qrRoute) || null;
  }, [modules, normalizeModuleRoute, qrRoute]);

  const qrBasePrice = useMemo(() => {
    const rawPrice = qrModule?.price;
    const price = Number(rawPrice ?? 0);
    if (price && price > 0) return price;
    return getModulePrice(qrRoute);
  }, [qrModule?.price, qrRoute]);

  const loadModulePrice = useCallback(() => {
    setModulePriceLoading(true);
    const rawPrice = currentModule?.price;
    const price = Number(rawPrice ?? 0);
    if (price && price > 0) { setModulePrice(price); setModulePriceLoading(false); return; }
    const fallbackPrice = getModulePrice(location.pathname || MODULE_ROUTE);
    setModulePrice(fallbackPrice);
    setModulePriceLoading(false);
  }, [currentModule, location.pathname]);

  const loadBalances = useCallback(() => {
    if (!user) return;
    setPlanBalance(balance.saldo_plano || 0);
    setWalletBalance(balance.saldo || 0);
  }, [user, balance]);

  const loadMeusPedidos = useCallback(async () => {
    try {
      setPedidosLoading(true);
      const userId = user?.id ? Number(user.id) : null;
      const result = await pdfRgService.listar({ limit: 50, offset: 0, ...(userId ? { user_id: userId } : {}) });
      if (result.success && result.data) {
        setMeusPedidos(result.data.data || []);
      } else {
        setMeusPedidos([]);
      }
    } catch { setMeusPedidos([]); }
    finally { setPedidosLoading(false); }
  }, [user?.id]);

  useEffect(() => {
    if (balance.saldo !== undefined || balance.saldo_plano !== undefined) loadBalances();
  }, [balance, loadBalances]);

  useEffect(() => {
    if (!user) return;
    reloadApiBalance();
    loadMeusPedidos();
  }, [user, reloadApiBalance, loadMeusPedidos]);

  useEffect(() => { if (user) loadModulePrice(); }, [user, loadModulePrice]);

  useEffect(() => {
    if (!user) { setBalanceCheckLoading(false); return; }
    if (modulePriceLoading || !modulePrice) return;
    if (subscriptionLoading) return;
    setBalanceCheckLoading(false);
  }, [user, modulePriceLoading, modulePrice, subscriptionLoading]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    if (field === 'cpf') value = value.replace(/\D/g, '');
    if (field === 'nome' || field === 'pai' || field === 'mae' || field === 'naturalidade') value = value.toUpperCase();
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const readFileAsDataUrl = (file: File, cb: (url: string) => void) => {
    const reader = new FileReader();
    reader.onloadend = () => cb(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Foto muito grande (máx 10MB)'); return; }
    setFormData(prev => ({ ...prev, foto: file }));
    readFileAsDataUrl(file, setPhotoPreviewUrl);
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Assinatura muito grande (máx 10MB)'); return; }
    setFormData(prev => ({ ...prev, assinatura: file }));
    readFileAsDataUrl(file, setSignaturePreviewUrl);
  };

  const handleAnexosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 3) { toast.error('Máximo 3 anexos permitidos'); return; }
    for (const f of files) {
      if (f.size > 15 * 1024 * 1024) { toast.error(`Arquivo ${f.name} muito grande (máx 15MB)`); return; }
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
      if (!allowed.includes(f.type)) { toast.error(`Formato inválido: ${f.name}. Use JPG, PNG, GIF ou PDF`); return; }
    }
    setFormData(prev => ({ ...prev, anexos: files.slice(0, 3) }));
  };

  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cpf.trim()) { toast.error('CPF é obrigatório'); return; }
    if (!hasSufficientBalance(totalPrice)) { toast.error(`Saldo insuficiente. Necessário: R$ ${totalPrice.toFixed(2)}`); return; }
    setShowConfirmModal(true);
  };

  const originalPrice = modulePrice > 0 ? modulePrice : 0;
  const { discountedPrice: finalPrice, hasDiscount } = hasActiveSubscription && originalPrice > 0
    ? calculateSubscriptionDiscount(originalPrice) : { discountedPrice: originalPrice, hasDiscount: false };
  const discount = hasDiscount ? discountPercentage : 0;

  const qrFinalPrice = hasActiveSubscription && qrBasePrice > 0
    ? calculateSubscriptionDiscount(qrBasePrice).discountedPrice : qrBasePrice;

  const totalPrice = finalPrice + qrFinalPrice;

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        cpf: formData.cpf.trim(),
        nome: formData.nome.trim() || null,
        dt_nascimento: formData.dataNascimento || null,
        naturalidade: formData.naturalidade.trim() || null,
        filiacao_mae: formData.mae.trim() || null,
        filiacao_pai: formData.pai.trim() || null,
        diretor: formData.diretor || null,
        qr_plan: qrPlan,
        preco_pago: totalPrice,
        desconto_aplicado: discount,
        module_id: currentModule?.id || 0,
      };

      if (formData.foto) payload.foto_base64 = await fileToBase64(formData.foto);
      if (formData.assinatura) payload.assinatura_base64 = await fileToBase64(formData.assinatura);

      for (let i = 0; i < formData.anexos.length; i++) {
        payload[`anexo${i + 1}_base64`] = await fileToBase64(formData.anexos[i]);
        payload[`anexo${i + 1}_nome`] = formData.anexos[i].name;
      }

      const result = await pdfRgService.criar(payload);
      if (!result.success) throw new Error(result.error || 'Erro ao criar pedido');

      // Cobrar saldo
      try {
        let remainingPlan = planBalance;
        let remainingWallet = walletBalance;
        let walletType: 'main' | 'plan' = 'main';
        let saldoUsado: 'plano' | 'carteira' | 'misto' = 'carteira';

        if (remainingPlan >= totalPrice) {
          saldoUsado = 'plano'; walletType = 'plan'; remainingPlan -= totalPrice;
        } else if (remainingPlan > 0 && remainingPlan + remainingWallet >= totalPrice) {
          saldoUsado = 'misto'; remainingWallet -= (totalPrice - remainingPlan); remainingPlan = 0;
        } else {
          remainingWallet -= totalPrice;
        }

        await walletApiService.addBalance(0, -totalPrice, `Pedido PDF RG - CPF ${formData.cpf}`, 'consulta', undefined, walletType);

        await consultationApiService.recordConsultation({
          document: formData.cpf,
          status: 'completed',
          cost: totalPrice,
          result_data: { pedido_id: result.data?.id },
          saldo_usado: saldoUsado,
          module_id: currentModule?.id || 0,
          metadata: {
            page_route: location.pathname,
            module_name: MODULE_TITLE,
            module_id: currentModule?.id || 0,
            saldo_usado: saldoUsado,
            source: 'pdf-rg',
            timestamp: new Date().toISOString(),
          },
        });

        setPlanBalance(Math.max(0, remainingPlan));
        setWalletBalance(Math.max(0, remainingWallet));
        await reloadApiBalance();

        window.dispatchEvent(new CustomEvent('balanceRechargeUpdated', {
          detail: { userId: user?.id, shouldAnimate: true, amount: totalPrice, method: 'api' },
        }));
      } catch (balanceError) {
        console.error('Erro ao registrar cobrança:', balanceError);
        toast.error('Pedido criado, mas houve erro ao registrar a cobrança.');
      }

      setShowConfirmModal(false);
      handleReset();
      await loadMeusPedidos();
      toast.success('Pedido criado com sucesso! Aguarde a confecção.');
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast.error(error.message || 'Erro ao criar pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({ cpf: '', nome: '', dataNascimento: '', naturalidade: '', mae: '', pai: '', diretor: '', assinatura: null, foto: null, anexos: [] });
    setPhotoPreviewUrl(null);
    setSignaturePreviewUrl(null);
  };

  const handleBack = () => {
    if (window.history.length > 1) { navigate(-1); return; }
    navigate('/dashboard');
  };

  const handleViewPedido = async (pedido: PdfRgPedido) => {
    try {
      const result = await pdfRgService.obter(pedido.id);
      if (result.success && result.data) {
        setPedidoDetalhe(result.data);
        setShowDetalheModal(true);
      } else {
        toast.error('Erro ao carregar detalhes do pedido');
      }
    } catch { toast.error('Erro ao carregar pedido'); }
  };

  const handleDownloadPdf = (pedido: PdfRgPedido) => {
    if (!pedido.pdf_entrega_base64 || !pedido.pdf_entrega_nome) {
      toast.error('PDF ainda não disponível');
      return;
    }
    const link = document.createElement('a');
    link.href = pedido.pdf_entrega_base64;
    link.download = pedido.pdf_entrega_nome;
    link.click();
  };

  if (balanceCheckLoading || modulePriceLoading) {
    return <LoadingScreen message="Verificando acesso ao módulo..." variant="dashboard" />;
  }

  const formatFullDate = (dateString: string) =>
    new Date(dateString).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      <div className="w-full">
        <SimpleTitleBar title={MODULE_TITLE} subtitle="Solicite a confecção de RG em PDF" onBack={handleBack} />

        <div className="mt-4 md:mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 md:gap-6 lg:gap-8">
          <Card className="dark:bg-gray-800 dark:border-gray-700 w-full">
            <CardHeader className="pb-4">
              <div className="relative bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 dark:from-gray-800/50 dark:via-gray-800 dark:to-emerald-900/20 rounded-lg border border-emerald-100/50 dark:border-emerald-800/30 shadow-sm transition-all duration-300">
                {hasDiscount && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
                    <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 px-2.5 py-1 text-xs font-bold shadow-lg">
                      {discount}% OFF
                    </Badge>
                  </div>
                )}
                <div className="relative p-3.5 md:p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-1 h-10 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Plano Ativo</p>
                        <h3 className="text-sm md:text-base font-bold text-foreground truncate">
                          {hasActiveSubscription ? subscription?.plan_name : userPlan}
                        </h3>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {hasDiscount && (
                        <span className="text-[10px] md:text-xs text-muted-foreground line-through">R$ {originalPrice.toFixed(2)}</span>
                      )}
                      <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent whitespace-nowrap">
                        R$ {totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <form onSubmit={handleOpenConfirmModal} className="space-y-4">
                {/* QR Code Period */}
                <div className="space-y-2">
                  <Label>Período do QR Code *</Label>
                  <Select value={qrPlan} onValueChange={(v) => setQrPlan(v as any)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1m">QR Code RG 1M</SelectItem>
                      <SelectItem value="3m">QR Code RG 3M</SelectItem>
                      <SelectItem value="6m">QR Code RG 6M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">Registro Geral - CPF * <span className="text-xs text-muted-foreground">(obrigatório)</span></Label>
                  <Input id="cpf" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={11} placeholder="CPF (somente números)" value={formData.cpf} onChange={(e) => handleInputChange('cpf', e.target.value)} required className="text-xs sm:text-sm placeholder:text-xs sm:placeholder:text-sm" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" type="text" placeholder="Nome completo" value={formData.nome} onChange={(e) => handleInputChange('nome', e.target.value)} className="text-xs sm:text-sm placeholder:text-xs sm:placeholder:text-sm" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataNascimento">Data de Nascimento</Label>
                  <Input id="dataNascimento" type="date" value={formData.dataNascimento} onChange={(e) => handleInputChange('dataNascimento', e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="naturalidade">Naturalidade</Label>
                  <Input id="naturalidade" type="text" placeholder="Naturalidade" value={formData.naturalidade} onChange={(e) => handleInputChange('naturalidade', e.target.value)} className="text-xs sm:text-sm placeholder:text-xs sm:placeholder:text-sm" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assinatura">Assinatura do Titular</Label>
                  <Input id="assinatura" type="file" accept="image/jpeg,image/jpg,image/png,image/gif" onChange={handleSignatureChange} className="cursor-pointer" />
                  {signaturePreviewUrl && (
                    <div className="mt-2">
                      <img src={signaturePreviewUrl} alt="Preview assinatura" className="w-24 h-24 object-contain rounded-lg border bg-background" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="foto">Foto 3x4</Label>
                  <Input id="foto" type="file" accept="image/jpeg,image/jpg,image/png,image/gif" onChange={handlePhotoChange} className="cursor-pointer" />
                  {photoPreviewUrl && (
                    <div className="mt-2">
                      <img src={photoPreviewUrl} alt="Preview foto" className="w-24 h-24 object-cover rounded-lg border" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mae">Filiação / Mãe</Label>
                  <Input id="mae" type="text" placeholder="Nome da mãe" value={formData.mae} onChange={(e) => handleInputChange('mae', e.target.value)} className="text-xs sm:text-sm placeholder:text-xs sm:placeholder:text-sm" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pai">Filiação / Pai</Label>
                  <Input id="pai" type="text" placeholder="Nome do pai" value={formData.pai} onChange={(e) => handleInputChange('pai', e.target.value)} className="text-xs sm:text-sm placeholder:text-xs sm:placeholder:text-sm" />
                </div>

                <div className="space-y-2">
                  <Label>Selecione o Diretor</Label>
                  <Select value={formData.diretor} onValueChange={(v) => setFormData(prev => ({ ...prev, diretor: v as any }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {DIRETORES.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Anexos */}
                <div className="space-y-2">
                  <Label htmlFor="anexos">Anexos <span className="text-xs text-muted-foreground">(até 3 arquivos - foto ou PDF)</span></Label>
                  <Input id="anexos" type="file" accept="image/jpeg,image/jpg,image/png,image/gif,application/pdf" multiple onChange={handleAnexosChange} className="cursor-pointer" />
                  {formData.anexos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.anexos.map((f, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          <Upload className="h-3 w-3 mr-1" /> {f.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <Button type="submit" disabled={isLoading || !formData.cpf || !hasSufficientBalance(totalPrice) || modulePriceLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</>
                    ) : (
                      <><FileText className="mr-2 h-4 w-4" />{modulePriceLoading ? 'Carregando preço...' : `Solicitar Pedido (R$ ${totalPrice.toFixed(2)})`}</>
                    )}
                  </Button>

                  {!hasSufficientBalance(totalPrice) && (
                    <div className="flex items-center gap-2 text-destructive text-xs">
                      <AlertCircle className="h-4 w-4" />
                      <span>Saldo insuficiente. Necessário: R$ {totalPrice.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Sidebar - Meus Pedidos */}
          <div className="space-y-4">
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Meus Pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                {pedidosLoading ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : meusPedidos.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum pedido encontrado</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {meusPedidos.map((p) => {
                      const st = STATUS_LABELS[p.status] || STATUS_LABELS['realizado'];
                      return (
                        <div key={p.id} className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-semibold">#{p.id}</span>
                            <Badge className={`${st.color} text-white text-[10px] gap-1`}>
                              {st.icon} {st.label}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p>CPF: {p.cpf}</p>
                            {p.nome && <p>Nome: {p.nome}</p>}
                            <p>{formatFullDate(p.created_at)}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => handleViewPedido(p)}>
                              <Eye className="h-3 w-3 mr-1" /> Ver
                            </Button>
                            {p.status === 'entregue' && p.pdf_entrega_nome && (
                              <Button size="sm" variant="default" className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDownloadPdf(p)}>
                                <Download className="h-3 w-3 mr-1" /> PDF
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Pedido</DialogTitle>
            <DialogDescription>Revise os dados antes de confirmar</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">CPF:</span>
              <span className="font-mono">{formData.cpf}</span>
              {formData.nome && <><span className="text-muted-foreground">Nome:</span><span>{formData.nome}</span></>}
              {formData.dataNascimento && <><span className="text-muted-foreground">Nascimento:</span><span>{formData.dataNascimento.split('-').reverse().join('/')}</span></>}
              {formData.mae && <><span className="text-muted-foreground">Mãe:</span><span>{formData.mae}</span></>}
              {formData.pai && <><span className="text-muted-foreground">Pai:</span><span>{formData.pai}</span></>}
              {formData.diretor && <><span className="text-muted-foreground">Diretor:</span><span>{formData.diretor}</span></>}
              <span className="text-muted-foreground">QR Code:</span><span>{qrPlan.toUpperCase()}</span>
              <span className="text-muted-foreground">Anexos:</span><span>{formData.anexos.length} arquivo(s)</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span className="text-emerald-600">R$ {totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleConfirmSubmit} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</> : <><CheckCircle className="mr-2 h-4 w-4" />Confirmar Pedido</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes do Pedido */}
      <Dialog open={showDetalheModal} onOpenChange={setShowDetalheModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{pedidoDetalhe?.id}</DialogTitle>
            <DialogDescription>Detalhes do pedido</DialogDescription>
          </DialogHeader>
          {pedidoDetalhe && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                {(() => { const st = STATUS_LABELS[pedidoDetalhe.status] || STATUS_LABELS['realizado']; return <Badge className={`${st.color} text-white gap-1`}>{st.icon} {st.label}</Badge>; })()}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">CPF:</span><span className="font-mono">{pedidoDetalhe.cpf}</span>
                {pedidoDetalhe.nome && <><span className="text-muted-foreground">Nome:</span><span>{pedidoDetalhe.nome}</span></>}
                {pedidoDetalhe.dt_nascimento && <><span className="text-muted-foreground">Nascimento:</span><span>{pedidoDetalhe.dt_nascimento.split('-').reverse().join('/')}</span></>}
                {pedidoDetalhe.naturalidade && <><span className="text-muted-foreground">Naturalidade:</span><span>{pedidoDetalhe.naturalidade}</span></>}
                {pedidoDetalhe.filiacao_mae && <><span className="text-muted-foreground">Mãe:</span><span>{pedidoDetalhe.filiacao_mae}</span></>}
                {pedidoDetalhe.filiacao_pai && <><span className="text-muted-foreground">Pai:</span><span>{pedidoDetalhe.filiacao_pai}</span></>}
                {pedidoDetalhe.diretor && <><span className="text-muted-foreground">Diretor:</span><span>{pedidoDetalhe.diretor}</span></>}
                <span className="text-muted-foreground">QR Code:</span><span>{pedidoDetalhe.qr_plan?.toUpperCase()}</span>
                <span className="text-muted-foreground">Valor:</span><span>R$ {Number(pedidoDetalhe.preco_pago).toFixed(2)}</span>
                <span className="text-muted-foreground">Data:</span><span>{formatFullDate(pedidoDetalhe.created_at)}</span>
              </div>

              {pedidoDetalhe.foto_base64 && (
                <div><p className="text-muted-foreground mb-1">Foto 3x4:</p><img src={pedidoDetalhe.foto_base64} alt="Foto" className="w-20 h-20 object-cover rounded border" /></div>
              )}
              {pedidoDetalhe.assinatura_base64 && (
                <div><p className="text-muted-foreground mb-1">Assinatura:</p><img src={pedidoDetalhe.assinatura_base64} alt="Assinatura" className="w-32 h-16 object-contain rounded border bg-white" /></div>
              )}

              {(pedidoDetalhe.anexo1_nome || pedidoDetalhe.anexo2_nome || pedidoDetalhe.anexo3_nome) && (
                <div>
                  <p className="text-muted-foreground mb-1">Anexos:</p>
                  <div className="flex flex-wrap gap-2">
                    {[pedidoDetalhe.anexo1_nome, pedidoDetalhe.anexo2_nome, pedidoDetalhe.anexo3_nome].filter(Boolean).map((nome, i) => (
                      <Badge key={i} variant="secondary" className="text-xs"><Upload className="h-3 w-3 mr-1" />{nome}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {pedidoDetalhe.status === 'entregue' && pedidoDetalhe.pdf_entrega_nome && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground mb-2">📄 PDF Entregue:</p>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleDownloadPdf(pedidoDetalhe)}>
                    <Download className="h-4 w-4 mr-2" /> {pedidoDetalhe.pdf_entrega_nome}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ScrollToTop />
    </div>
  );
};

export default PdfRg;
