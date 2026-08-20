import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '@/hooks/use-language'
import {
  LayoutDashboard,
  Users,
  Settings as SettingsIcon,
  Bot,
  ChefHat,
  MessageCircle,
  UserPlus,
  CreditCard,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const location = useLocation()
  const { t } = useLanguage()

  const navItems = [
    { name: t('overview_nav'), path: '/app', icon: LayoutDashboard },
    { name: t('conversas_nav'), path: '/app/conversas', icon: MessageCircle },
    { name: t('agent_nav'), path: '/app/agent', icon: Bot },
    { name: t('recipes_nav'), path: '/app/recipes', icon: ChefHat },
    { name: t('patients_nav'), path: '/app/pacientes', icon: UserPlus },
    { name: t('plans_nav'), path: '/app/planos', icon: CreditCard },
    { name: 'Alertas', path: '/app/notifications', icon: Bell },
    { name: t('contacts_nav'), path: '/app/contacts', icon: Users },
    { name: t('settings_nav'), path: '/app/settings', icon: SettingsIcon },
  ]

  return (
    <nav className="fixed bottom-0 left-0 z-40 w-full border-t border-border bg-background/90 backdrop-blur-2xl pb-safe md:hidden">
      <div className="flex h-[4.5rem] justify-around items-center px-1 overflow-x-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/app' && location.pathname.startsWith(item.path))
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center shrink-0 px-2.5 gap-1.5 text-[10px] font-bold transition-all duration-300',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <item.icon
                className={cn(
                  'h-[22px] w-[22px] mb-0.5 transition-colors duration-300',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )}
              />
              <span className="truncate max-w-[64px]">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
