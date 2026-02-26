import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, RefreshCw, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { centralCashApiService, type CentralCashTransaction } from '@/services/centralCashApiService';
import { formatDate } from '@/utils/historicoUtils';

const HistoricoCadastrosApi = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<CentralCashTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await centralCashApiService.getRecentTransactions(100);
      if (result.success && result.data) {
        // Filtrar apenas compras de módulos (Login Hotmail, Editáveis RG, etc.)
        const modulePurchases = result.data.filter(
          t => t.transaction_type === 'compra_modulo' || 
               t.description?.toLowerCase().includes('compra de')
        );
        setTransactions(modulePurchases);
      }
    } catch (error) {
      console.error('Erro ao carregar cadastros:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-3 sm:space-y-6 relative z-10 px-1 sm:px-0">
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="truncate">Histórico · Cadastros na API</span>
            </CardTitle>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadTransactions}
                disabled={isLoading}
                className="h-8 sm:h-9"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/dashboard/historico')}
                className="rounded-full h-9 w-9"
                aria-label="Voltar"
                title="Voltar"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="p-3 sm:p-6 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Compras de Módulos
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {transactions.length} registros
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Carregando registros...</p>
            </div>
          ) : transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((tx) => {
                let parsedMeta: any = null;
                try {
                  if (tx.metadata) {
                    parsedMeta = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
                  }
                } catch {}

                return (
                  <div
                    key={tx.id}
                    className="border rounded-lg p-3 sm:p-4 bg-card border-l-4 border-l-violet-500 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium">{tx.description}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(tx.created_at)}
                          </span>
                          {parsedMeta?.module_name && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {parsedMeta.module_name}
                            </Badge>
                          )}
                          {tx.payment_method && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 uppercase">
                              {tx.payment_method}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-xs font-semibold px-2 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 flex-shrink-0"
                      >
                        {formatCurrency(tx.amount)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma compra de módulo registrada ainda</p>
              <p className="text-xs mt-1">As compras de Login Hotmail e Editáveis RG aparecerão aqui</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoricoCadastrosApi;
