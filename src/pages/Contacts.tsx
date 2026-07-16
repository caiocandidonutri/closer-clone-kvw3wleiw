import { useState, useMemo } from 'react'
import { useContacts } from '@/hooks/use-contacts'
import { useLanguage } from '@/hooks/use-language'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Search, UserRound, Loader2, MessageSquare, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { id: 'All', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'responded', label: 'Responded' },
]

export default function Contacts() {
  const { t, language } = useLanguage()
  const dateLocale = language === 'pt' ? ptBR : enUS
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('All')
  const { contacts, loading } = useContacts(search)
  const navigate = useNavigate()

  const filtered = useMemo(() => {
    if (activeTab === 'All') return contacts
    return contacts.filter((c) => c.status === activeTab)
  }, [contacts, activeTab])

  return (
    <div className="max-w-7xl mx-auto space-y-10 p-6 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-apple min-h-full bg-background">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-foreground">{t('contacts')}</h2>
          <p className="text-muted-foreground mt-2 font-medium text-base">
            {t('manage_network') || 'Manage your network'}
          </p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={t('search_placeholder') || 'Search contacts...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-14 bg-card shadow-sm border-border hover:border-border/80 focus-visible:ring-primary/20 transition-all"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start h-auto flex-wrap bg-transparent p-0 gap-3 mb-8">
          {CATEGORIES.map((cat) => {
            const count =
              cat.id === 'All'
                ? contacts.length
                : contacts.filter((c) => c.status === cat.id).length
            return (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent data-[state=inactive]:bg-card data-[state=inactive]:border-border data-[state=inactive]:text-muted-foreground rounded-full px-5 py-2.5 transition-all duration-300 shadow-subtle"
              >
                <span className="font-semibold text-[14px]">{cat.label}</span>
                <span className="bg-current/10 text-current px-2.5 py-0.5 rounded-full text-[11px] font-bold opacity-90 ml-2">
                  {count}
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      <div className="w-full">
        {loading ? (
          <div className="p-24 flex justify-center bg-card rounded-[2.5rem] border border-border shadow-subtle">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground/50" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 bg-card rounded-[2.5rem] border border-border shadow-subtle">
            <div className="bg-muted w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserRound className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              {t('no_contacts_found') || 'No contacts found'}
            </h3>
            <p className="text-muted-foreground max-w-sm mx-auto mt-3 font-medium text-base">
              {search ? 'Try a different search.' : 'No contacts in this category yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((contact) => (
              <div
                key={contact.id}
                className="group relative flex flex-col bg-card rounded-[2rem] p-6 border border-border/60 shadow-subtle hover:shadow-elevation transition-all duration-300 hover:-translate-y-1.5 cursor-pointer overflow-hidden"
                onClick={() => navigate(`/app/chat/${contact.id}`)}
              >
                <div className="flex justify-between items-start mb-5">
                  <Avatar className="h-14 w-14 border-2 border-background shadow-sm transition-transform duration-300 group-hover:scale-105">
                    <AvatarImage src={contact.avatar_url || ''} />
                    <AvatarFallback className="bg-muted text-foreground font-bold text-lg">
                      {contact.name?.charAt(0) || '#'}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-all duration-300 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full h-10 w-10 shrink-0 -mr-2 -mt-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/app/chat/${contact.id}`)
                    }}
                  >
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </div>

                <div className="mb-6 flex-1">
                  <h3 className="font-bold text-xl tracking-tight text-foreground line-clamp-1 mb-1 group-hover:text-primary transition-colors duration-300">
                    {contact.name || 'Unknown'}
                  </h3>
                  <p className="text-sm font-semibold text-muted-foreground truncate">
                    {contact.whatsapp_id}
                  </p>
                </div>

                <div className="flex flex-col gap-4 mt-auto pt-5 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={cn(
                        'font-bold tracking-tight shadow-sm text-[11px] px-3 py-1 rounded-full',
                        contact.status === 'pending'
                          ? 'bg-amber-100/50 text-amber-600 border-amber-200'
                          : 'bg-green-100/50 text-green-600 border-green-200',
                      )}
                    >
                      {contact.status === 'pending' ? 'Pending' : 'Responded'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground/80">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {contact.created
                        ? formatDistanceToNow(new Date(contact.created), {
                            addSuffix: true,
                            locale: dateLocale,
                          })
                        : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
