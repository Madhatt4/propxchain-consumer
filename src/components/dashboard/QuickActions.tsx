import React from 'react';
import { Plus, Users, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface QuickActionProps {
  onAction: (action: string) => void;
}

const QuickActions: React.FC<QuickActionProps> = ({ onAction }) => {
  const actions = [
    {
      id: 'new-transaction',
      title: 'New Transaction',
      description: 'Start a sale or purchase',
      icon: Plus,
      color: 'text-gray-500',
      bgColor: 'bg-gray-600/10',
      borderColor: 'border-gray-500/20',
      hoverBorder: 'hover:border-gray-500',
      primary: true
    },
    {
      id: 'join-transaction',
      title: 'Join Transaction',
      description: 'Enter ID to join existing',
      icon: Users,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      hoverBorder: 'hover:border-green-500',
      primary: false
    },
    {
      id: 'invite-stakeholder',
      title: 'Invite Stakeholder',
      description: 'Add solicitor or agent',
      icon: Users,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      hoverBorder: 'hover:border-purple-500',
      primary: false
    },
    {
      id: 'verify-identity',
      title: 'Complete profile',
      description: 'Add your contact details',
      icon: ShieldCheck,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20',
      hoverBorder: 'hover:border-orange-500',
      primary: false
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {actions.map((action) => (
        <Card 
          key={action.id}
          className={cn(
            "cursor-pointer transition-all duration-300 border bg-gray-800/50 backdrop-blur-sm group",
            action.borderColor,
            action.hoverBorder,
            action.primary ? "shadow-[0_0_15px_rgba(59,130,246,0.15)]" : ""
          )}
          onClick={() => onAction(action.id)}
        >
          <CardContent className="p-6 flex items-start space-x-4">
            <div className={cn("p-3 rounded-xl transition-colors group-hover:scale-110 duration-300", action.bgColor)}>
              <action.icon className={cn("w-6 h-6", action.color)} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm mb-1 group-hover:text-gray-500 transition-colors">
                {action.title}
              </h3>
              <p className="text-xs text-gray-400 leading-tight">
                {action.description}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default QuickActions;
