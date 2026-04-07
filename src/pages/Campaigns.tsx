import { useMemo, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { Plus, ChevronDown, ChevronRight, Image as ImageIcon, Video, Folder, LayoutGrid, X, Upload, Megaphone, Target, MousePointer2, Edit2, CheckCircle2, Trash2, WalletCards, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Campaigns() {
  const { campaigns, campaignSpendEntries, adGroups, ads, areasOfLaw, services, addCampaign, updateCampaign, deleteCampaign, addCampaignSpendEntry, updateCampaignSpendEntry, deleteCampaignSpendEntry, addAdGroup, updateAdGroup, deleteAdGroup, addAd, updateAd, deleteAd } = useStore();

  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignAreaId, setNewCampaignAreaId] = useState('');
  const [newCampaignServiceId, setNewCampaignServiceId] = useState('');
  const [newAdGroupNames, setNewAdGroupNames] = useState<string[]>([]);

  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});
  const [expandedAdGroups, setExpandedAdGroups] = useState<Record<string, boolean>>({});

  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [selectedAdGroupIdForAd, setSelectedAdGroupIdForAd] = useState('');
  const [newAdName, setNewAdName] = useState('');
  const [newAdMediaUrl, setNewAdMediaUrl] = useState('');
  const [newAdMediaUrlInput, setNewAdMediaUrlInput] = useState('');
  const [newAdMediaType, setNewAdMediaType] = useState<'image' | 'video'>('image');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [isSavingAd, setIsSavingAd] = useState(false);
  const [adSaveError, setAdSaveError] = useState<string | null>(null);
  const [isAdGroupModalOpen, setIsAdGroupModalOpen] = useState(false);
  const [adGroupMode, setAdGroupMode] = useState<'create' | 'edit'>('create');
  const [adGroupNameInput, setAdGroupNameInput] = useState('');
  const [adGroupCampaignId, setAdGroupCampaignId] = useState('');
  const [editingAdGroupId, setEditingAdGroupId] = useState<string | null>(null);
  const [isSpendModalOpen, setIsSpendModalOpen] = useState(false);
  const [editingSpendEntryId, setEditingSpendEntryId] = useState<string | null>(null);
  const [spendCampaignId, setSpendCampaignId] = useState('');
  const [spendAmount, setSpendAmount] = useState('');
  const [spendStartDate, setSpendStartDate] = useState('');
  const [spendEndDate, setSpendEndDate] = useState('');
  const [spendNotes, setSpendNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleCampaign = (id: string) => setExpandedCampaigns(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleAdGroup = (id: string) => setExpandedAdGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const availableServices = services.filter(s => s.areaOfLawId === newCampaignAreaId);
  const spendEntriesByCampaign = useMemo(() => (campaignSpendEntries || []).reduce<Record<string, typeof campaignSpendEntries>>((acc, entry) => {
    if (!acc[entry.campaignId]) acc[entry.campaignId] = [];
    acc[entry.campaignId].push(entry);
    return acc;
  }, {}), [campaignSpendEntries]);

  const getCampaignTotalSpend = (campaignId: string) => (spendEntriesByCampaign[campaignId] || []).reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

  const openCreateSpendModal = (campaignId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    setEditingSpendEntryId(null);
    setSpendCampaignId(campaignId);
    setSpendAmount('');
    setSpendStartDate(today);
    setSpendEndDate(today);
    setSpendNotes('');
    setIsSpendModalOpen(true);
  };

  const openEditSpendModal = (entry: { id: string; campaignId: string; amount: number; startDate: string; endDate: string; notes?: string }) => {
    setEditingSpendEntryId(entry.id);
    setSpendCampaignId(entry.campaignId);
    setSpendAmount(String(entry.amount));
    setSpendStartDate(entry.startDate);
    setSpendEndDate(entry.endDate);
    setSpendNotes(entry.notes || '');
    setIsSpendModalOpen(true);
  };

  const openEditCampaignModal = (campaign: any) => {
    setEditingCampaignId(campaign.id);
    setNewCampaignName(campaign.name);
    setNewCampaignAreaId(campaign.areaOfLawId || '');
    setNewCampaignServiceId(campaign.serviceId || '');
    setNewAdGroupNames([]);
    setIsCampaignModalOpen(true);
  };

  const openEditAdModal = (ad: any) => {
    const mediaUrl = ad.mediaUrl || '';
    setEditingAdId(ad.id);
    setSelectedAdGroupIdForAd(ad.adGroupId);
    setNewAdName(ad.name);
    setNewAdMediaUrl(mediaUrl);
    setNewAdMediaUrlInput(mediaUrl.startsWith('data:') ? '' : mediaUrl);
    setNewAdMediaType(ad.mediaType || 'image');
    setAdSaveError(null);
    setIsAdModalOpen(true);
  };

  const closeAdModal = () => {
    setIsAdModalOpen(false);
    setNewAdName('');
    setNewAdMediaUrl('');
    setNewAdMediaUrlInput('');
    setEditingAdId(null);
    setShowSaveSuccess(false);
    setIsSavingAd(false);
    setAdSaveError(null);
  };

  const openCreateAdGroupModal = (campaignId: string) => {
    setAdGroupMode('create');
    setAdGroupCampaignId(campaignId);
    setEditingAdGroupId(null);
    setAdGroupNameInput('');
    setIsAdGroupModalOpen(true);
  };

  const openEditAdGroupModal = (adGroup: { id: string; name: string; campaignId: string }) => {
    setAdGroupMode('edit');
    setAdGroupCampaignId(adGroup.campaignId);
    setEditingAdGroupId(adGroup.id);
    setAdGroupNameInput(adGroup.name);
    setIsAdGroupModalOpen(true);
  };

  const handleAdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdName.trim() || isSavingAd) return;

    setIsSavingAd(true);
    setAdSaveError(null);
    try {
      if (editingAdId) {
        updateAd(editingAdId, { name: newAdName.trim(), mediaUrl: newAdMediaUrl, mediaType: newAdMediaType });
      } else {
        addAd(selectedAdGroupIdForAd, newAdName.trim(), newAdMediaUrl, newAdMediaType);
      }
      setShowSaveSuccess(true);
      window.setTimeout(() => closeAdModal(), 850);
    } catch (error) {
      setIsSavingAd(false);
      setShowSaveSuccess(false);
      setAdSaveError(error instanceof Error ? error.message : 'Falha ao salvar criativo');
    }
  };

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold gold-text-gradient tracking-tight">Campanhas Ativas</h1>
          <p className="text-muted-foreground mt-2 font-medium tracking-widest uppercase text-[10px]">Arquitetura de Conversão & Criativos</p>
        </div>
        <button
          onClick={() => {
            setEditingCampaignId(null);
            setNewCampaignName('');
            setNewCampaignAreaId('');
            setNewCampaignServiceId('');
            setNewAdGroupNames([]);
            setIsCampaignModalOpen(true);
          }}
          className="flex items-center gap-3 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gold-400 transition-all shadow-lg shadow-gold-500/20"
        >
          <Plus className="w-5 h-5" />
          Nova Campanha
        </button>
      </header>

      <div className="space-y-6">
        {(campaigns || []).length === 0 ? (
          <div className="p-20 text-center bg-card rounded-3xl border-2 border-dashed border-border">
            <Megaphone className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
            <p className="text-muted-foreground font-serif italic text-xl">Nenhuma campanha estratégica ativa.</p>
            <button
              onClick={() => {
                setEditingCampaignId(null);
                setNewCampaignName('');
                setNewCampaignAreaId('');
                setNewCampaignServiceId('');
                setNewAdGroupNames([]);
                setIsCampaignModalOpen(true);
              }}
              className="mt-6 text-primary font-black text-[10px] uppercase tracking-widest hover:underline"
            >
              Iniciar Primeira Campanha
            </button>
          </div>
        ) : (
          (campaigns || []).map(campaign => {
            const area = areasOfLaw.find(a => a.id === campaign.areaOfLawId);
            const service = services.find(s => s.id === campaign.serviceId);
            const spendEntries = [...(spendEntriesByCampaign[campaign.id] || [])].sort((a, b) => b.startDate.localeCompare(a.startDate));
            const totalSpend = getCampaignTotalSpend(campaign.id);
            return (
              <div key={campaign.id} className="bg-card rounded-3xl border border-border shadow-2xl overflow-hidden group">
                <div className="w-full flex items-center justify-between p-6 hover:bg-accent transition-all">
                  <button onClick={() => toggleCampaign(campaign.id)} className="flex-1 flex items-center gap-4 text-left">
                    <div className="w-12 h-12 rounded-xl bg-accent border border-border flex items-center justify-center text-primary">
                      <Folder className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-serif font-bold text-foreground">{campaign.name}</h2>
                      <div className="flex gap-2 mt-1">
                        <p className="text-[10px] text-gold-500/60 font-black uppercase tracking-widest">
                          {(adGroups || []).filter(ag => ag.campaignId === campaign.id).length} Conjuntos de Anúncios
                        </p>
                        {area && (
                          <span className="text-[10px] bg-accent text-primary px-2 rounded uppercase tracking-widest">
                            {area.name}
                          </span>
                        )}
                        {service && (
                          <span className="text-[10px] bg-emerald-900/20 text-emerald-500 px-2 rounded uppercase tracking-widest">
                            {service.name}
                          </span>
                        )}
                        <span className="text-[10px] bg-gold-500/10 text-gold-500 px-2 rounded uppercase tracking-widest">
                          Investimento R$ {totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-4">
                    <button onClick={(e) => { e.stopPropagation(); openEditCampaignModal(campaign); }} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Excluir esta campanha? Os conjuntos e criativos vinculados serão removidos.')) {
                          deleteCampaign(campaign.id);
                        }
                      }}
                      className="p-2 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => toggleCampaign(campaign.id)}>
                      {expandedCampaigns[campaign.id] ? <ChevronDown className="w-6 h-6 text-primary" /> : <ChevronRight className="w-6 h-6 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {expandedCampaigns[campaign.id] && (
                  <div className="p-6 pt-0 space-y-4 bg-background/20 border-t border-border">
                    <div className="bg-muted rounded-2xl border border-border p-4 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gold-500/60">Investimento por período</p>
                          <h3 className="text-lg font-serif font-bold">Histórico de custos da campanha</h3>
                        </div>
                        <button
                          onClick={() => openCreateSpendModal(campaign.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar investimento
                        </button>
                      </div>
                      {spendEntries.length === 0 ? (
                        <div className="border border-dashed border-border rounded-2xl px-4 py-6 text-sm text-muted-foreground">
                          Nenhum período de investimento cadastrado nesta campanha ainda.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {spendEntries.map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-border bg-background/40 px-4 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl border border-border bg-accent flex items-center justify-center text-primary">
                                  <WalletCards className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">
                                    R$ {Number(entry.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-[11px] uppercase tracking-widest text-gold-500/60">
                                    {new Date(`${entry.startDate}T00:00:00`).toLocaleDateString('pt-BR')} até {new Date(`${entry.endDate}T00:00:00`).toLocaleDateString('pt-BR')}
                                  </p>
                                  {entry.notes && <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => openEditSpendModal(entry)} className="px-3 py-2 rounded-lg border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-gold-500/30">
                                  Editar
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Excluir este lançamento de investimento?')) {
                                      deleteCampaignSpendEntry(entry.id);
                                    }
                                  }}
                                  className="px-3 py-2 rounded-lg border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-red-400 hover:border-red-500/30"
                                >
                                  Excluir
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {(adGroups || []).filter(ag => ag.campaignId === campaign.id).map(ag => (
                      <div key={ag.id} className="bg-muted rounded-2xl border border-border overflow-hidden">
                        <div className="w-full flex items-center justify-between p-4 hover:bg-accent transition-all">
                          <button onClick={() => toggleAdGroup(ag.id)} className="flex-1 flex items-center gap-3 text-left">
                            <Target className="w-5 h-5 text-gold-500/60" />
                            <span className="font-bold text-foreground text-sm tracking-wide">{ag.name}</span>
                          </button>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditAdGroupModal(ag);
                                
                              }}
                              className="p-1 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Excluir este conjunto de anuncios e seus criativos?')) {
                                  deleteAdGroup(ag.id);
                                }
                              }}
                              className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => toggleAdGroup(ag.id)}>
                              {expandedAdGroups[ag.id] ? <ChevronDown className="w-4 h-4 text-gold-500/50" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </button>
                          </div>
                        </div>

                        {expandedAdGroups[ag.id] && (
                          <div className="p-4 pt-0 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                              {(ads || []).filter(a => a.adGroupId === ag.id).map(ad => (
                                <div key={ad.id} className="bg-background/40 p-3 rounded-2xl border border-border flex flex-col gap-3 group/ad hover:border-gold-500/30 transition-all relative">
                                  <div className="absolute top-4 right-4 z-20 opacity-0 group-hover/ad:opacity-100 transition-opacity">
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => openEditAdModal(ad)} className="p-2 bg-background/80 rounded-lg text-primary hover:bg-primary hover:text-primary-foreground transition-all">
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (confirm('Excluir este criativo?')) {
                                            deleteAd(ad.id);
                                          }
                                        }}
                                        className="p-2 bg-background/80 rounded-lg text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-background">
                                    {ad.mediaUrl ? (
                                      ad.mediaType === 'video' ? (
                                        <video src={ad.mediaUrl} className="w-full h-full object-cover" />
                                      ) : (
                                        <img src={ad.mediaUrl} alt={ad.name} className="w-full h-full object-cover" />
                                      )
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                        <LayoutGrid className="w-8 h-8" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover/ad:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                      <MousePointer2 className="w-6 h-6 text-primary" />
                                    </div>
                                  </div>
                                  <p className="font-bold text-muted-foreground text-[10px] uppercase tracking-widest truncate px-1">{ad.name}</p>
                                </div>
                              ))}

                              <button
                                onClick={() => {
                                  setEditingAdId(null);
                                  setSelectedAdGroupIdForAd(ag.id);
                                  setNewAdName('');
                                  setNewAdMediaUrl('');
                                  setNewAdMediaUrlInput('');
                                  setNewAdMediaType('image');
                                  setAdSaveError(null);
                                  setIsAdModalOpen(true);
                                }}
                                className="aspect-video border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:border-gold-500/30 hover:bg-accent transition-all"
                              >
                                <Plus className="w-6 h-6" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Novo Criativo</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        openCreateAdGroupModal(campaign.id);
                        
                      }}
                      className="flex items-center gap-2 text-[10px] font-black text-gold-500/60 hover:text-primary uppercase tracking-widest px-4 py-2 rounded-xl border border-border hover:border-gold-500/30 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Conjunto
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Campaign Modal */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-8 w-full max-w-md shadow-2xl border border-border max-h-[90vh] overflow-y-auto scrollbar-none">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-serif font-bold gold-text-gradient">{editingCampaignId ? 'Editar Campanha' : 'Nova Campanha'}</h2>
              <button onClick={() => setIsCampaignModalOpen(false)} className="p-2 text-muted-foreground hover:text-primary rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (newCampaignName.trim()) {
                if (editingCampaignId) {
                  updateCampaign(editingCampaignId, { name: newCampaignName.trim(), areaOfLawId: newCampaignAreaId || undefined, serviceId: newCampaignServiceId || undefined });
                } else {
                  const campaignId = addCampaign(newCampaignName.trim(), newCampaignAreaId || undefined, newCampaignServiceId || undefined);
                  newAdGroupNames.forEach(name => { if (name.trim()) addAdGroup(campaignId, name.trim()); });
                  setExpandedCampaigns(prev => ({ ...prev, [campaignId]: true }));
                }
                setIsCampaignModalOpen(false);
                setNewCampaignName('');
                setNewCampaignAreaId('');
                setNewCampaignServiceId('');
                setNewAdGroupNames([]);
                setEditingCampaignId(null);
              }
            }} className="space-y-8">
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Nome da Campanha</label>
                <input required value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} type="text" placeholder="Ex: Captação Trabalhista - Elite" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Área de Atuação (Opcional)</label>
                <select value={newCampaignAreaId} onChange={(e) => { setNewCampaignAreaId(e.target.value); setNewCampaignServiceId(''); }} className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all">
                  <option value="">Selecione uma área</option>
                  {areasOfLaw.map(area => (<option key={area.id} value={area.id}>{area.name}</option>))}
                </select>
              </div>

              {newCampaignAreaId && (
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Serviço (Opcional)</label>
                  <select value={newCampaignServiceId} onChange={(e) => setNewCampaignServiceId(e.target.value)} className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all">
                    <option value="">Selecione um serviço</option>
                    {availableServices.map(service => (<option key={service.id} value={service.id}>{service.name}</option>))}
                  </select>
                </div>
              )}

              {!editingCampaignId && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest">Conjuntos de Anúncios</label>
                    <button type="button" onClick={() => setNewAdGroupNames([...newAdGroupNames, ''])} className="text-[10px] font-black text-primary hover:text-gold-400 flex items-center gap-1 uppercase tracking-widest">
                      <Plus className="w-3 h-3" /> Adicionar
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newAdGroupNames.map((name, index) => (
                      <div key={index} className="flex gap-2">
                        <input value={name} onChange={(e) => { const n = [...newAdGroupNames]; n[index] = e.target.value; setNewAdGroupNames(n); }} type="text" placeholder={`Conjunto ${index + 1}`} className="flex-1 px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all" />
                        <button type="button" onClick={() => setNewAdGroupNames(newAdGroupNames.filter((_, i) => i !== index))} className="p-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {newAdGroupNames.length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-4 border border-dashed border-border rounded-xl">Nenhum conjunto definido.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4 pt-6 border-t border-border">
                <button type="button" onClick={() => setIsCampaignModalOpen(false)} className="px-6 py-2 text-muted-foreground font-black text-[10px] uppercase tracking-widest">Cancelar</button>
                <button type="submit" className="px-8 py-3 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold-400 transition-all shadow-xl">
                  {editingCampaignId ? 'Salvar Alterações' : 'Criar Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSpendModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-border max-h-[90vh] overflow-y-auto scrollbar-none">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gold-500/60 font-black">Investimento de campanha</p>
                <h2 className="text-2xl font-serif font-bold gold-text-gradient">{editingSpendEntryId ? 'Editar período' : 'Novo período'}</h2>
              </div>
              <button onClick={() => setIsSpendModalOpen(false)} className="p-2 text-muted-foreground hover:text-primary rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!spendCampaignId || !spendStartDate || !spendEndDate) return;
                const payload = {
                  amount: Number(spendAmount) || 0,
                  startDate: spendStartDate,
                  endDate: spendEndDate,
                  notes: spendNotes.trim(),
                };
                if (editingSpendEntryId) {
                  updateCampaignSpendEntry(editingSpendEntryId, payload);
                } else {
                  addCampaignSpendEntry(spendCampaignId, payload);
                }
                setIsSpendModalOpen(false);
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Valor investido</label>
                  <input
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Campanha</label>
                  <div className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground">
                    {(campaigns || []).find((campaign) => campaign.id === spendCampaignId)?.name || 'Campanha selecionada'}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Início do período</label>
                  <div className="relative">
                    <input
                      value={spendStartDate}
                      onChange={(e) => setSpendStartDate(e.target.value)}
                      type="date"
                      className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                    />
                    <CalendarRange className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Fim do período</label>
                  <div className="relative">
                    <input
                      value={spendEndDate}
                      onChange={(e) => setSpendEndDate(e.target.value)}
                      type="date"
                      className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                    />
                    <CalendarRange className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Observação</label>
                <textarea
                  value={spendNotes}
                  onChange={(e) => setSpendNotes(e.target.value)}
                  rows={3}
                  placeholder="Ex: verba Meta Ads da primeira quinzena"
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all resize-none"
                />
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-border">
                <button type="button" onClick={() => setIsSpendModalOpen(false)} className="px-6 py-2 text-muted-foreground font-black text-[10px] uppercase tracking-widest">Cancelar</button>
                <button type="submit" className="px-8 py-3 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold-400 transition-all shadow-xl">
                  {editingSpendEntryId ? 'Salvar período' : 'Adicionar período'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ad Modal with success animation */}
      {isAdModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-8 w-full max-w-md shadow-2xl border border-border relative max-h-[90vh] overflow-y-auto scrollbar-none">
            {/* Success overlay */}
            {showSaveSuccess && (
              <div className="absolute inset-0 z-50 bg-card flex flex-col items-center justify-center animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 animate-scale-in">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <p className="text-lg font-serif font-bold text-foreground">Criativo Salvo!</p>
              </div>
            )}

            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-serif font-bold gold-text-gradient">{editingAdId ? 'Editar Criativo' : 'Novo Criativo'}</h2>
              <button onClick={closeAdModal} className="p-2 text-muted-foreground hover:text-primary rounded-lg" disabled={isSavingAd}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAdSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">Nome do Criativo</label>
                <input required value={newAdName} onChange={(e) => setNewAdName(e.target.value)} type="text" placeholder="Ex: AD 01 - Prova Social" className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-4">Formato da Mídia</label>
                <div className="flex gap-4 mb-6">
                  <button type="button" onClick={() => setNewAdMediaType('image')} className={cn("flex-1 py-3 rounded-xl flex items-center justify-center gap-2 border text-[10px] font-black uppercase tracking-widest transition-all", newAdMediaType === 'image' ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-gold-500/20' : 'bg-background/40 text-muted-foreground border-border hover:border-gold-500/30')}>
                    <ImageIcon className="w-4 h-4" /> Imagem
                  </button>
                  <button type="button" onClick={() => setNewAdMediaType('video')} className={cn("flex-1 py-3 rounded-xl flex items-center justify-center gap-2 border text-[10px] font-black uppercase tracking-widest transition-all", newAdMediaType === 'video' ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-gold-500/20' : 'bg-background/40 text-muted-foreground border-border hover:border-gold-500/30')}>
                    <Video className="w-4 h-4" /> Vídeo
                  </button>
                </div>

                <div className="space-y-4">
                  <input
                    type="url"
                    value={newAdMediaUrlInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewAdMediaUrlInput(value);
                      setNewAdMediaUrl(value);
                    }}
                    placeholder="Cole a URL da mídia (CDN)..."
                    className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                  />
                  {newAdMediaUrl.startsWith('data:') && (
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      Midia local carregada por upload.
                    </p>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="h-px bg-border flex-1"></div>
                    <span className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">OU</span>
                    <div className="h-px bg-border flex-1"></div>
                  </div>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full py-4 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-accent hover:border-gold-500/30 transition-all">
                    <Upload className="w-5 h-5 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Upload de Arquivo</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept={newAdMediaType === 'image' ? "image/*" : "video/*"}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setNewAdMediaUrl(reader.result as string);
                          setNewAdMediaUrlInput('');
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>

                {newAdMediaUrl && (
                  <div className="mt-6 p-3 border border-border rounded-2xl bg-background/40">
                    <p className="text-[8px] font-black text-gold-500/60 uppercase tracking-widest mb-3">Pré-visualização</p>
                    {newAdMediaType === 'video' ? (
                      <video src={newAdMediaUrl} controls className="w-full aspect-video object-cover rounded-xl bg-background border border-border" />
                    ) : (
                      <img src={newAdMediaUrl} alt="Preview" className="w-full aspect-video object-cover rounded-xl border border-border" />
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-border">
                <button type="button" onClick={closeAdModal} className="px-6 py-2 text-muted-foreground font-black text-[10px] uppercase tracking-widest" disabled={isSavingAd}>Cancelar</button>
                <button type="submit" className="px-8 py-3 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gold-400 transition-all shadow-xl disabled:opacity-70" disabled={isSavingAd}>
                  {isSavingAd ? 'Salvando...' : (editingAdId ? 'Salvar Alteracoes' : 'Salvar Criativo')}
                </button>
              </div>
              {adSaveError && (
                <p className="text-xs text-red-400">{adSaveError}</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Ad Group Modal */}
      {isAdGroupModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-3xl p-8 w-full max-w-md shadow-2xl border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-bold gold-text-gradient">
                {adGroupMode === 'edit' ? 'Editar Conjunto' : 'Novo Conjunto'}
              </h2>
              <button onClick={() => setIsAdGroupModalOpen(false)} className="p-2 text-muted-foreground hover:text-primary rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = adGroupNameInput.trim();
                if (!name) return;

                if (adGroupMode === 'edit' && editingAdGroupId) {
                  updateAdGroup(editingAdGroupId, { name });
                } else if (adGroupMode === 'create') {
                  addAdGroup(adGroupCampaignId, name);
                }
                setIsAdGroupModalOpen(false);
                setAdGroupNameInput('');
                setEditingAdGroupId(null);
              }}
              className="space-y-6"
            >
              <div>
                <label className="block text-[10px] font-black text-gold-500/60 uppercase tracking-widest mb-2">
                  Nome do Conjunto
                </label>
                <input
                  autoFocus
                  value={adGroupNameInput}
                  onChange={(e) => setAdGroupNameInput(e.target.value)}
                  className="w-full px-4 py-3 bg-background/40 border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all"
                  placeholder="Ex: Mulheres 35+"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsAdGroupModalOpen(false)} className="px-6 py-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                  Cancelar
                </button>
                <button type="submit" className="px-8 py-3 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest">
                  {adGroupMode === 'edit' ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



