import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { pdfRgService } from '@/services/pdfRgService';
import { useNavigate } from 'react-router-dom';

const AdminServicesSummary = () => {
  const [pending, setPending] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [pendingRes, completedRes] = await Promise.all([
          pdfRgService.listar({ status: 'realizado', limit: 1 }),
          pdfRgService.listar({ status: 'entregue', limit: 1 }),
        ]);
        if (pendingRes.success && pendingRes.data) {
          setPending(pendingRes.data.pagination.total);
        }
        if (completedRes.success && completedRes.data) {
          setCompleted(completedRes.data.pagination.total);
        }
      } catch (e) {
        console.warn('Erro ao carregar resumo de serviços:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cards = [
    {
      label: 'Serviços Pendentes',
      value: pending,
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Serviços Concluídos',
      value: completed,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map((card) => (
        <Card
          key={card.label}
          className={`cursor-pointer hover:shadow-md transition-shadow border ${card.border}`}
          onClick={() => navigate('/dashboard/admin/pedidos')}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`p-3 rounded-xl ${card.bg}`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-1" />
              ) : (
                <p className="text-2xl font-bold">{card.value}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminServicesSummary;
