
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface PanelNavigationProps {
  calculateTotalAvailableBalance: () => number;
  painelId?: string;
}

const PanelNavigation = ({ calculateTotalAvailableBalance, painelId }: PanelNavigationProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const checkBalanceAndNavigate = (path: string, moduleName: string, modulePrice: string) => {
    if (!user) return;

    const price = parseFloat(modulePrice);
    
    // Usar saldo total disponível (mesmo da carteira digital)
    const totalAvailableBalance = calculateTotalAvailableBalance();
    
    console.log('PanelNavigation - Verificando saldo para navegação:', {
      moduleName,
      price,
      totalAvailableBalance,
      painelId
    });
    
    if (totalAvailableBalance < price) {
      const remaining = Math.max(price - totalAvailableBalance, 0.01);
      toast.error(
        `Saldo insuficiente para ${moduleName}! Valor necessário: R$ ${price.toFixed(2)}`,
        {
          action: {
            label: "💰 Depositar",
            onClick: () => navigate(`/dashboard/adicionar-saldo?valor=${remaining.toFixed(2)}&fromModule=true`)
          }
        }
      );
      return;
    }

    navigate(path);
  };

  return { checkBalanceAndNavigate };
};

export default PanelNavigation;
