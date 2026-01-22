import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AddressPoint, Sale, VisitStatus, User, UserRole, Sector, Permission } from './types';
import { MOCK_ADDRESSES, STATUS_COLORS, STATUS_LABELS } from './constants';
import SaleModal from './components/SaleModal';
import { generateDailyReport } from './services/geminiService';

// --- Toast Component ---
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'info' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgClass = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

  return (
    <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-3 rounded-2xl text-white font-bold shadow-2xl animate-fade-in-down ${bgClass}`}>
      <i className={`fas ${icon}`}></i>
      <span className="text-[11px] uppercase tracking-widest">{message}</span>
    </div>
  );
};

// --- Permissions Logic ---
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.PORTEUR]: ['VIEW_MAP', 'VIEW_LIST', 'RECORD_SALE', 'VIEW_STATS_PERSONAL'],
  [UserRole.RESPONSABLE]: ['VIEW_MAP', 'VIEW_LIST', 'RECORD_SALE', 'VIEW_STATS_SECTOR'],
  [UserRole.ADMIN]: ['VIEW_MAP', 'VIEW_LIST', 'RECORD_SALE', 'VIEW_STATS_GLOBAL', 'MANAGE_SECTORS', 'MANAGE_USERS', 'MANAGE_SETTINGS']
};

const hasPermission = (user: User, permission: Permission) => {
  return ROLE_PERMISSIONS[user.role].includes(permission);
};

// --- Icons Setup ---
const createCustomIcon = (status: VisitStatus) => {
  const color = STATUS_COLORS[status];
  const html = `
    <div style="
      background-color: ${color};
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 8px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 9px;
    ">
      <i class="fas ${status === VisitStatus.DONE ? 'fa-check' : status === VisitStatus.ABSENT ? 'fa-clock' : status === VisitStatus.REFUSED ? 'fa-times' : 'fa-map-pin'}"></i>
    </div>
  `;
  return L.divIcon({
    html: html,
    className: 'custom-marker',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

const MapController = ({ center, zoom, userLoc }: { center: [number, number], zoom: number, userLoc: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (userLoc) {
      map.flyTo(userLoc, 18, { duration: 1.5 });
    } else {
      map.flyTo(center, zoom, { duration: 1 });
    }
  }, [center, userLoc, zoom, map]);
  return null;
};

// --- Auth View ---
const LoginView: React.FC<{ onLogin: (user: User) => void, sectors: Sector[] }> = ({ onLogin, sectors }) => {
  const [rescueCenter, setRescueCenter] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.PORTEUR);
  const [sectorId, setSectorId] = useState<string>('');
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [existingProfile, setExistingProfile] = useState<User | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('firecal_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setExistingProfile(u);
        setRescueCenter(u.rescueCenter || '');
        setLastName(u.lastName || '');
        setFirstName(u.firstName || '');
        setRole(u.role || UserRole.PORTEUR);
        if (u.rescueCenterLogo) setLogo(u.rescueCenterLogo);
        if (u.sectorId) setSectorId(u.sectorId);
      } catch (e) { console.error(e); }
    } else { setIsCreatingNew(true); }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAdminAuth = () => {
    if (password === 'admin' || password === localStorage.getItem('firecal_admin_pass')) {
      if (existingProfile) onLogin(existingProfile);
      else submitCreation();
    } else { alert("Mot de passe incorrect"); }
  };

  const submitCreation = () => {
    if (rescueCenter && lastName && firstName) {
      if (role === UserRole.ADMIN) localStorage.setItem('firecal_admin_pass', password);
      onLogin({ id: Date.now().toString(), rescueCenter, lastName, firstName, role, rescueCenterLogo: logo, sectorId: role !== UserRole.ADMIN ? sectorId : undefined });
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === UserRole.ADMIN) handleAdminAuth();
    else submitCreation();
  };

  const roleIndex = role === UserRole.PORTEUR ? 0 : role === UserRole.RESPONSABLE ? 1 : 2;

  const Copyright = () => (
    <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center justify-center gap-2 opacity-60">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">© 2024 FireCal - Tous droits réservés</span>
        <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white dark:bg-slate-800 shadow-xl p-1 border border-slate-200 dark:border-slate-700">
           <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
              {/* S metal - simplified style */}
              <path d="M70,30 C70,15 30,15 30,35 C30,45 70,55 70,65 C70,85 30,85 30,70" fill="none" stroke="#475569" strokeWidth="14" strokeLinecap="round" />
              {/* C blue */}
              <path d="M80,25 C90,40 90,60 80,75" fill="none" stroke="#0ea5e9" strokeWidth="14" strokeLinecap="round" />
              {/* Flame orange */}
              <path d="M20,60 C25,45 35,40 45,55 C55,70 40,85 20,85 C35,80 30,65 20,60" fill="#f97316" />
           </svg>
        </div>
      </div>
    </div>
  );

  if (existingProfile && !isCreatingNew) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center p-8 animate-fade-in relative overflow-hidden">
        <div className="relative z-10 w-full max-w-sm">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black italic text-slate-900 dark:text-white uppercase tracking-tighter mb-2">FireCal</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Retour en service</p>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[32px] p-6 shadow-2xl mb-6 transform transition-all hover:scale-[1.02]">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-[32px] bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-xl overflow-hidden mb-4">
                {existingProfile.rescueCenterLogo ? <img src={existingProfile.rescueCenterLogo} className="w-full h-full object-cover" alt="Logo" /> : <div className="w-full h-full flex items-center justify-center text-3xl text-slate-300"><i className="fas fa-user"></i></div>}
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">{existingProfile.firstName} {existingProfile.lastName}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white ${existingProfile.role === UserRole.ADMIN ? 'bg-red-600' : existingProfile.role === UserRole.RESPONSABLE ? 'bg-fire-orange' : 'bg-blue-600'}`}>{existingProfile.role}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">{existingProfile.rescueCenter}</span>
              </div>
            </div>
            <div className="mt-8 space-y-4">
              {existingProfile.role === UserRole.ADMIN ? (
                <div className="animate-fade-in">
                  <label className="block text-center text-slate-400 text-[9px] font-black uppercase tracking-widest mb-2">Sécurité Admin</label>
                  <input type="password" autoFocus placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-center font-bold text-slate-900 dark:text-white focus:outline-none focus:border-fire-orange" />
                  <button onClick={handleAdminAuth} className="w-full mt-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 py-4 rounded-xl font-black uppercase text-sm tracking-wide shadow-lg">Déverrouiller</button>
                </div>
              ) : (
                <button onClick={() => onLogin(existingProfile)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-sm tracking-wide shadow-lg">Reprendre la tournée</button>
              )}
            </div>
          </div>
          <button onClick={() => { setIsCreatingNew(true); setPassword(''); }} className="w-full text-center text-slate-400 hover:text-fire-orange text-[10px] font-black uppercase tracking-widest transition-colors">Nouveau profil ?</button>
        </div>
        <Copyright />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col p-8 justify-center animate-fade-in overflow-y-auto no-scrollbar relative">
      <div className="mb-6 text-center relative z-10">
        <div onClick={() => fileInputRef.current?.click()} className="w-20 h-20 bg-white/20 dark:bg-slate-900/50 backdrop-blur-xl border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[28px] mx-auto flex items-center justify-center shadow-2xl mb-4 cursor-pointer overflow-hidden relative">
          {logo ? <img src={logo} alt="Logo" className="w-full h-full object-cover" /> : <div className="flex flex-col items-center"><i className="fas fa-camera text-slate-500 text-xl"></i></div>}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
        </div>
        <h1 className="text-4xl font-black italic text-slate-900 dark:text-white uppercase tracking-tighter">Création Profil</h1>
      </div>
      <form onSubmit={handleCreateSubmit} className="space-y-3 max-w-sm mx-auto w-full relative z-10">
        <input required placeholder="Centre de Secours" value={rescueCenter} onChange={(e) => setRescueCenter(e.target.value)} className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl py-3.5 px-6 focus:outline-none text-sm font-bold" />
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl py-3.5 px-6 focus:outline-none text-sm font-bold" />
          <input required placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl py-3.5 px-6 focus:outline-none text-sm font-bold" />
        </div>
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-1 rounded-2xl border border-slate-200 dark:border-slate-800 relative flex h-12 items-center shadow-inner">
          <div className="absolute h-10 w-[32%] bg-fire-orange rounded-xl transition-all duration-300 ease-out shadow-lg shadow-fire-orange/20" style={{ transform: `translateX(${roleIndex * 105}%)` }}></div>
          <button type="button" onClick={() => setRole(UserRole.PORTEUR)} className={`flex-1 z-10 text-[8px] font-black uppercase tracking-wider transition-colors ${role === UserRole.PORTEUR ? 'text-white' : 'text-slate-500'}`}>Porteur</button>
          <button type="button" onClick={() => setRole(UserRole.RESPONSABLE)} className={`flex-1 z-10 text-[8px] font-black uppercase tracking-wider transition-colors ${role === UserRole.RESPONSABLE ? 'text-white' : 'text-slate-500'}`}>Chef</button>
          <button type="button" onClick={() => setRole(UserRole.ADMIN)} className={`flex-1 z-10 text-[8px] font-black uppercase tracking-wider transition-colors ${role === UserRole.ADMIN ? 'text-white' : 'text-slate-500'}`}>Admin</button>
        </div>
        {role === UserRole.ADMIN && <input type="password" required placeholder="Définir mot de passe (admin)" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-100 rounded-2xl py-3.5 px-6 focus:outline-none text-sm font-bold" />}
        {role !== UserRole.ADMIN && (
          <select required value={sectorId} onChange={(e) => setSectorId(e.target.value)} className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl py-3.5 px-6 focus:outline-none text-sm font-bold appearance-none">
            <option value="">Sélectionner un secteur</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <button type="submit" className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 py-4 rounded-2xl font-black italic uppercase text-lg shadow-2xl mt-2">Démarrer</button>
      </form>
      <Copyright />
    </div>
  );
};

// --- Admin Manager View ---
const AdminManagerView: React.FC<{
  sectors: Sector[],
  onAddSector: (name: string) => void,
  onUpdateSector: (sector: Sector) => void,
  onDeleteSector: (id: string) => void,
  onAddStreetsToSector: (sectorId: string, streets: string[]) => void,
  teamMembers: User[],
  onAddTeamMember: (user: User) => void,
  onUpdateTeamMember: (user: User) => void,
  onDeleteTeamMember: (id: string) => void,
  addresses: AddressPoint[],
  sales: Sale[],
  theme: 'light' | 'dark',
  onThemeToggle: () => void,
  user: User
}> = ({ sectors, onAddSector, onUpdateSector, onDeleteSector, onAddStreetsToSector, teamMembers, onAddTeamMember, onUpdateTeamMember, onDeleteTeamMember, addresses, sales, theme, onThemeToggle, user }) => {
  const [activeTab, setActiveTab] = useState<'sectors' | 'team'>('sectors');
  const [newSectorName, setNewSectorName] = useState('');
  const [streetInputs, setStreetInputs] = useState<Record<string, string>>({});
  const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
  const [tempSectorName, setTempSectorName] = useState('');
  const [newMemberFN, setNewMemberFN] = useState('');
  const [newMemberLN, setNewMemberLN] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>(UserRole.PORTEUR);

  const availableStreets = useMemo(() => {
    const assigned = new Set(sectors.flatMap(s => s.streets));
    return Array.from(new Set(addresses.map(a => a.streetName))).filter(s => !assigned.has(s));
  }, [sectors, addresses]);

  const handleAddStreets = (sectorId: string) => {
    const streets = (streetInputs[sectorId] || '').split(',').map(s => s.trim()).filter(Boolean);
    if (streets.length) { onAddStreetsToSector(sectorId, streets); setStreetInputs({ ...streetInputs, [sectorId]: '' }); }
  };

  const getSectorStats = (sector: Sector) => {
    const streetSet = new Set(sector.streets);
    const sectorSales = sales.filter(s => {
      const addr = addresses.find(a => a.id === s.addressId);
      return addr && streetSet.has(addr.streetName);
    });
    const total = sectorSales.reduce((sum, s) => sum + s.amount, 0);
    const done = addresses.filter(a => streetSet.has(a.streetName) && a.status === VisitStatus.DONE).length;
    return { total, done, avg: done > 0 ? (total / done).toFixed(1) : "0" };
  };

  const handleAssignResponsable = (sectorId: string, respId: string) => {
    const s = sectors.find(sec => sec.id === sectorId);
    if (s) {
      onUpdateSector({ ...s, responsableId: respId || undefined });
      if (respId) {
        const u = teamMembers.find(m => m.id === respId);
        if (u) onUpdateTeamMember({ ...u, sectorId });
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8 pb-32">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-black italic text-slate-900 dark:text-white uppercase tracking-tighter">Gestion</h1>
        <button onClick={onThemeToggle} className="w-12 h-6 bg-slate-300 dark:bg-slate-800 rounded-full relative">
          <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-all ${theme === 'dark' ? 'translate-x-6 bg-fire-orange' : 'bg-white'}`}></div>
        </button>
      </div>

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button onClick={() => setActiveTab('sectors')} className={`text-sm font-black uppercase tracking-widest pb-2 ${activeTab === 'sectors' ? 'text-fire-orange border-b-2 border-fire-orange' : 'text-slate-400'}`}>Secteurs</button>
        <button onClick={() => setActiveTab('team')} className={`text-sm font-black uppercase tracking-widest pb-2 ${activeTab === 'team' ? 'text-fire-orange border-b-2 border-fire-orange' : 'text-slate-400'}`}>Effectifs</button>
      </div>

      {activeTab === 'team' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900/40 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-slate-500 text-[10px] font-black uppercase mb-4">Ajouter un membre</h3>
            <form onSubmit={e => { e.preventDefault(); onAddTeamMember({ id: Date.now().toString(), firstName: newMemberFN, lastName: newMemberLN, role: newMemberRole, rescueCenter: user.rescueCenter }); setNewMemberFN(''); setNewMemberLN(''); }} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <input required placeholder="Nom" value={newMemberLN} onChange={e => setNewMemberLN(e.target.value)} className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" />
              <input required placeholder="Prénom" value={newMemberFN} onChange={e => setNewMemberFN(e.target.value)} className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" />
              <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value as UserRole)} className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold">
                <option value={UserRole.PORTEUR}>Porteur</option>
                <option value={UserRole.RESPONSABLE}>Responsable</option>
                <option value={UserRole.ADMIN}>Administrateur</option>
              </select>
              <button type="submit" className="bg-fire-orange text-white py-3 rounded-xl font-bold uppercase text-xs">Ajouter</button>
            </form>
          </div>
          <div className="space-y-3">
            {teamMembers.map(m => (
              <div key={m.id} className="bg-white dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold">{m.firstName[0]}{m.lastName[0]}</div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{m.firstName} {m.lastName}</h4>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full text-white ${m.role === UserRole.ADMIN ? 'bg-red-600' : m.role === UserRole.RESPONSABLE ? 'bg-fire-orange' : 'bg-blue-600'}`}>{m.role}</span>
                  </div>
                </div>
                <button onClick={() => onDeleteTeamMember(m.id)} className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-500"><i className="fas fa-trash text-xs"></i></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'sectors' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900/40 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl">
            <label className="block text-slate-500 text-[10px] font-black uppercase mb-3 italic">Nouveau Secteur</label>
            <div className="flex gap-2">
              <input value={newSectorName} onChange={e => setNewSectorName(e.target.value)} className="flex-1 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 dark:text-white" placeholder="Nom du secteur..." />
              <button onClick={() => { if(newSectorName){ onAddSector(newSectorName); setNewSectorName(''); }}} className="bg-fire-orange text-white px-5 rounded-xl font-bold"><i className="fas fa-plus"></i></button>
            </div>
          </div>

          <div className="space-y-4">
            {sectors.map(sector => {
              const stats = getSectorStats(sector);
              const responsible = teamMembers.find(m => m.id === sector.responsableId);
              const isLastSector = sectors.length <= 1;
              return (
                <div key={sector.id} className="bg-white dark:bg-slate-900/40 rounded-[32px] border border-slate-200 dark:border-slate-800 p-6 shadow-xl animate-fade-in">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      {editingSectorId === sector.id ? (
                        <div className="flex gap-2 mb-2">
                          <input autoFocus value={tempSectorName} onChange={e => setTempSectorName(e.target.value)} className="bg-slate-100 dark:bg-slate-800 border border-slate-300 rounded px-2 py-1 text-lg font-black uppercase w-full" />
                          <button onClick={() => { onUpdateSector({ ...sector, name: tempSectorName }); setEditingSectorId(null); }} className="text-green-500"><i className="fas fa-check"></i></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black italic uppercase text-slate-900 dark:text-white tracking-tighter">{sector.name}</h3>
                          <button onClick={() => { setEditingSectorId(sector.id); setTempSectorName(sector.name); }} className="text-slate-400 hover:text-fire-orange"><i className="fas fa-pen text-xs"></i></button>
                        </div>
                      )}
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Responsable : <span className="text-fire-orange">{responsible ? `${responsible.firstName} ${responsible.lastName}` : "Non assigné"}</span>
                      </p>
                    </div>
                    <button 
                      disabled={isLastSector}
                      onClick={() => { if(confirm("Supprimer ce secteur ?")) onDeleteSector(sector.id); }} 
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isLastSector ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'bg-red-50 dark:bg-red-900/20 text-red-500 active:scale-90'}`}
                      title={isLastSector ? "Impossible de supprimer le dernier secteur" : "Supprimer ce secteur"}
                    >
                      <i className="fas fa-trash text-xs"></i>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-6 text-center">
                    <div className="bg-slate-50 dark:bg-slate-950/30 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Fait</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{stats.done}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/30 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Total</p>
                      <p className="text-sm font-black text-green-600">{stats.total}€</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/30 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Moy.</p>
                      <p className="text-sm font-black text-blue-500">{stats.avg}€</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Assigner Responsable (Admin/Chef)</label>
                      <select value={sector.responsableId || ''} onChange={e => handleAssignResponsable(sector.id, e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold">
                        <option value="">-- Aucun --</option>
                        {teamMembers.filter(m => m.role === UserRole.RESPONSABLE || m.role === UserRole.ADMIN).map(m => (
                          <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.role})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Rues ({sector.streets.length})</label>
                      <div className="flex gap-2">
                        <input list={`streets-dl-${sector.id}`} value={streetInputs[sector.id] || ''} onChange={e => setStreetInputs({ ...streetInputs, [sector.id]: e.target.value })} className="flex-1 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-3 py-2 text-xs" placeholder="Rue de Rivoli, ..." />
                        <datalist id={`streets-dl-${sector.id}`}>{availableStreets.map(st => <option key={st} value={st} />)}</datalist>
                        <button onClick={() => handleAddStreets(sector.id)} className="bg-blue-600 text-white px-4 rounded-xl font-bold text-xs">OK</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// --- List View ---
const ListView: React.FC<{ addresses: AddressPoint[], sectors: Sector[], onMarkerClick: (addr: AddressPoint) => void, user: User }> = ({ addresses, sectors, onMarkerClick, user }) => {
  const isGlobalAdmin = hasPermission(user, 'VIEW_STATS_GLOBAL');
  const [selectedSecId, setSelectedSecId] = useState<string | null>(user.sectorId || null);
  const [filter, setFilter] = useState<VisitStatus | 'ALL'>('ALL');

  const filteredAddresses = useMemo(() => {
    let res = addresses;
    const currentSectorId = isGlobalAdmin ? selectedSecId : user.sectorId;
    if (currentSectorId) {
      const sector = sectors.find(s => s.id === currentSectorId);
      if (sector) {
        const streets = new Set(sector.streets);
        res = res.filter(a => streets.has(a.streetName));
      }
    }
    if (filter !== 'ALL') res = res.filter(a => a.status === filter);
    return res.sort((a, b) => a.streetName.localeCompare(b.streetName));
  }, [addresses, sectors, selectedSecId, user.sectorId, filter, isGlobalAdmin]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-6 pb-2 space-y-4">
        <h1 className="text-4xl font-black italic text-slate-900 dark:text-white uppercase tracking-tighter">Rues</h1>
        {isGlobalAdmin && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button onClick={() => setSelectedSecId(null)} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${!selectedSecId ? 'bg-fire-orange text-white border-fire-orange' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}>Tous les secteurs</button>
            {sectors.map(s => <button key={s.id} onClick={() => setSelectedSecId(s.id)} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${selectedSecId === s.id ? 'bg-fire-orange text-white border-fire-orange' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'}`}>{s.name}</button>)}
          </div>
        )}
        <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <button onClick={() => setFilter('ALL')} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[8px] font-black uppercase ${filter === 'ALL' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-900'}`}>Tout</button>
          {[VisitStatus.TODO, VisitStatus.DONE, VisitStatus.ABSENT].map(s => <button key={s} onClick={() => setFilter(s)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[8px] font-black uppercase ${filter === s ? 'text-white' : 'text-slate-500 bg-slate-100 dark:bg-slate-900'}`} style={filter === s ? {backgroundColor: STATUS_COLORS[s]} : {}}>{STATUS_LABELS[s]}</button>)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-2 pt-0 pb-32">
        {filteredAddresses.map(a => (
          <div key={a.id} onClick={() => onMarkerClick(a)} className="bg-white dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-lg active:scale-95 transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border-2" style={{ borderColor: STATUS_COLORS[a.status] + '40', color: STATUS_COLORS[a.status] }}>
                <i className={`fas ${a.status === VisitStatus.DONE ? 'fa-check' : a.status === VisitStatus.ABSENT ? 'fa-clock' : 'fa-home'}`}></i>
              </div>
              <div>
                <h3 className="font-black text-sm italic uppercase tracking-tighter text-slate-900 dark:text-white leading-tight">{a.streetNumber} {a.streetName}</h3>
                <p className="text-slate-400 text-[8px] font-black uppercase mt-0.5">{STATUS_LABELS[a.status]}</p>
              </div>
            </div>
            <i className="fas fa-chevron-right text-slate-300 text-[10px]"></i>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Map View ---
const MapView: React.FC<{ addresses: AddressPoint[], onMarkerClick: (addr: AddressPoint) => void, onAddAddress: (addr: AddressPoint) => void, theme: 'light' | 'dark' }> = ({ addresses, onMarkerClick, onAddAddress, theme }) => {
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([48.8566, 2.3522]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 3) { setResults([]); return; }
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`);
    const data = await res.json();
    setResults(data.features || []);
  };

  const select = (f: any) => {
    const [lng, lat] = f.geometry.coordinates;
    const { housenumber, street, label } = f.properties;
    setMapCenter([lat, lng]);
    setResults([]);
    setQuery(label);
    const existing = addresses.find(a => a.lat === lat && a.lng === lng);
    if (!existing) onAddAddress({ id: Date.now().toString(), lat, lng, streetNumber: housenumber || '?', streetName: street || '?', status: VisitStatus.TODO });
    else onMarkerClick(existing);
  };

  return (
    <div className="flex-1 relative overflow-hidden">
      <div className="absolute top-6 left-6 right-6 z-[1000] flex flex-col gap-2">
        <div className="bg-white/80 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[28px] shadow-2xl flex items-center px-5 py-3">
          <i className="fas fa-search text-slate-400 mr-3 text-sm"></i>
          <input type="text" placeholder="Rechercher une adresse..." value={query} onChange={e => handleSearch(e.target.value)} className="bg-transparent border-none text-slate-900 dark:text-white focus:outline-none flex-1 text-xs font-bold" />
        </div>
        {results.length > 0 && (
          <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50">
            {results.map((f, i) => (
              <button key={i} onClick={() => select(f)} className="w-full px-5 py-4 text-left hover:bg-fire-orange/5 flex items-center gap-3">
                <i className="fas fa-map-marker-alt text-fire-orange text-sm opacity-50"></i>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase italic tracking-tighter">{f.properties.label}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{f.properties.context}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer url={theme === 'dark' ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"} />
        {addresses.map(a => <Marker key={a.id} position={[a.lat, a.lng]} icon={createCustomIcon(a.status)} eventHandlers={{ click: () => onMarkerClick(a) }} />)}
        {userLoc && <Marker position={userLoc} icon={L.divIcon({ html: '<div class="w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-xl animate-pulse"></div>', iconSize: [24, 24], iconAnchor: [12, 12] })} />}
        <MapController center={mapCenter} zoom={15} userLoc={userLoc} />
      </MapContainer>
      <button onClick={() => navigator.geolocation.getCurrentPosition(pos => { setUserLoc([pos.coords.latitude, pos.coords.longitude]); setMapCenter([pos.coords.latitude, pos.coords.longitude]); })} className="absolute bottom-10 right-6 w-16 h-16 bg-white rounded-full shadow-2xl z-[1000] flex items-center justify-center text-slate-950 active:scale-90 transition-transform"><i className="fas fa-location-arrow text-2xl"></i></button>
    </div>
  );
};

// --- Dashboard View ---
const DashboardView: React.FC<{ sales: Sale[], addresses: AddressPoint[], user: User, sectors: Sector[], isOnline: boolean, onEditProfile: () => void }> = ({ sales, addresses, user, sectors, isOnline, onEditProfile }) => {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredSales = useMemo(() => {
    if (hasPermission(user, 'VIEW_STATS_GLOBAL')) return sales;
    if (user.sectorId) {
      const sector = sectors.find(s => s.id === user.sectorId);
      if (!sector) return [];
      const streets = new Set(sector.streets);
      return sales.filter(s => {
        const addr = addresses.find(a => a.id === s.addressId);
        return addr && streets.has(addr.streetName);
      });
    }
    return sales.filter(s => s.userId === user.id);
  }, [sales, user, sectors, addresses]);

  const filteredAddresses = useMemo(() => {
    if (hasPermission(user, 'VIEW_STATS_GLOBAL')) return addresses;
    if (user.sectorId) {
      const sector = sectors.find(s => s.id === user.sectorId);
      if (!sector) return [];
      const streets = new Set(sector.streets);
      return addresses.filter(a => streets.has(a.streetName));
    }
    return [];
  }, [addresses, user, sectors]);

  const total = filteredSales.reduce((sum, s) => sum + s.amount, 0);
  const done = filteredAddresses.filter(a => a.status === VisitStatus.DONE).length;
  const avg = done > 0 ? (total / done).toFixed(2) : "0.00";
  const scope = hasPermission(user, 'VIEW_STATS_GLOBAL') ? 'Accès Global (Admin)' : 'Vue Secteur';

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 pb-32">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-fire-orange rounded-2xl flex items-center justify-center text-white text-xl shadow-lg rotate-3"><i className="fas fa-chart-pie"></i></div>
          <div>
            <h1 className="text-3xl font-black italic text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Synthèse</h1>
            <p className="text-fire-orange text-[10px] font-black uppercase tracking-[0.2em]">{user.firstName} {user.lastName}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-[8px] font-black text-fire-orange bg-fire-orange/10 px-3 py-1.5 rounded-full uppercase tracking-widest">{scope}</div>
          <button 
            onClick={onEditProfile}
            className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-fire-orange/10 transition-colors px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 active:scale-95"
          >
            <i className="fas fa-user-edit text-[10px] text-slate-500"></i>
            <span className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-400">Mon Profil</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center">
          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Fait</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{done}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center">
          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Total Caserne</p>
          <p className="text-xl font-black text-green-600">{total}€</p>
        </div>
        <div className="bg-white dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center">
          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Moy.</p>
          <p className="text-xl font-black text-blue-500">{avg}€</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-slate-900 dark:text-white text-xs font-black italic uppercase tracking-widest flex items-center gap-2">Analyse IA</h3>
          <button onClick={async () => { setLoading(true); setReport(await generateDailyReport(filteredSales, filteredAddresses)); setLoading(false); }} disabled={!isOnline || loading} className={`text-[9px] font-black px-5 py-2.5 rounded-full uppercase tracking-widest ${isOnline ? 'bg-slate-900 dark:bg-white text-white dark:text-black' : 'bg-slate-100 text-slate-400'}`}>
            {loading ? 'Analyse...' : 'Générer'}
          </button>
        </div>
        {report ? <div className="text-slate-700 dark:text-slate-300 text-sm italic leading-relaxed bg-slate-50 dark:bg-slate-950/50 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800/50">{report}</div> : <p className="text-center text-slate-400 text-[10px] uppercase font-bold py-8">Cliquez pour analyser vos performances</p>}
      </div>
    </div>
  );
};

// --- App Shell ---
const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('firecal_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { return null; }
    }
    return null;
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('firecal_theme') as any) || 'dark');
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'stats' | 'admin'>('map');
  const [addresses, setAddresses] = useState<AddressPoint[]>(() => JSON.parse(localStorage.getItem('firecal_addresses') || JSON.stringify(MOCK_ADDRESSES)));
  const [sales, setSales] = useState<Sale[]>(() => JSON.parse(localStorage.getItem('firecal_sales') || '[]'));
  const [sectors, setSectors] = useState<Sector[]>(() => JSON.parse(localStorage.getItem('firecal_sectors') || JSON.stringify([
    { id: 'sec-1', name: 'Centre-Ville', streets: ['Rue de Rivoli', 'Av. Victoria'], porteurIds: [] },
    { id: 'sec-2', name: 'Sud-Est', streets: ['Rue de la Pompe', 'Bd du Palais'], porteurIds: [] }
  ])));
  const [teamMembers, setTeamMembers] = useState<User[]>(() => JSON.parse(localStorage.getItem('firecal_team') || '[]'));
  const [selectedAddress, setSelectedAddress] = useState<AddressPoint | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' | 'error' } | null>(null);

  useEffect(() => { if(currentUser) localStorage.setItem('firecal_user', JSON.stringify(currentUser)); }, [currentUser]);
  useEffect(() => localStorage.setItem('firecal_addresses', JSON.stringify(addresses)), [addresses]);
  useEffect(() => localStorage.setItem('firecal_sales', JSON.stringify(sales)), [sales]);
  useEffect(() => localStorage.setItem('firecal_sectors', JSON.stringify(sectors)), [sectors]);
  useEffect(() => localStorage.setItem('firecal_team', JSON.stringify(teamMembers)), [teamMembers]);
  useEffect(() => localStorage.setItem('firecal_theme', theme), [theme]);
  useEffect(() => { document.documentElement.className = theme; }, [theme]);

  // Online Tracking & Auto-Sync
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  useEffect(() => {
    if (isOnline && sales.some(s => !s.synced)) {
      const sync = async () => {
        setIsSyncing(true);
        await new Promise(r => setTimeout(r, 2000));
        setSales(prev => prev.map(s => s.synced ? s : { ...s, synced: true }));
        setIsSyncing(false);
        setToast({ message: "Données synchronisées avec succès", type: 'success' });
      };
      sync();
    }
  }, [isOnline]);

  const handleSaleSave = (s: Sale, st: VisitStatus) => {
    setSales([...sales, s]);
    setAddresses(addresses.map(a => a.id === s.addressId ? { ...a, status: st } : a));
    setSelectedAddress(null);
  };

  const handleUpdateSector = (s: Sector) => setSectors(sectors.map(sec => sec.id === s.id ? s : sec));
  
  const handleDeleteSector = (id: string) => {
    if (sectors.length <= 1) {
      setToast({ message: "Impossible de supprimer le dernier secteur.", type: 'error' });
      return;
    }
    setSectors(sectors.filter(s => s.id !== id));
    setTeamMembers(teamMembers.map(m => m.sectorId === id ? { ...m, sectorId: undefined } : m));
    if (currentUser?.sectorId === id) setCurrentUser({ ...currentUser, sectorId: undefined });
  };

  if (!currentUser) return <LoginView onLogin={setCurrentUser} sectors={sectors} />;
  const canManage = hasPermission(currentUser, 'MANAGE_SETTINGS') || hasPermission(currentUser, 'VIEW_STATS_SECTOR');

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className={`fixed top-0 left-0 right-0 z-[5000] h-1 bg-fire-orange transition-all duration-1000 ${isSyncing ? 'opacity-100 animate-pulse' : 'opacity-0'}`}></div>
      
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'map' && <MapView addresses={addresses} onMarkerClick={setSelectedAddress} onAddAddress={a => { setAddresses([a, ...addresses]); setSelectedAddress(a); }} theme={theme} />}
        {activeTab === 'list' && <ListView addresses={addresses} sectors={sectors} onMarkerClick={setSelectedAddress} user={currentUser} />}
        {activeTab === 'stats' && <DashboardView sales={sales} addresses={addresses} user={currentUser} sectors={sectors} isOnline={isOnline} onEditProfile={() => setCurrentUser(null)} />}
        {activeTab === 'admin' && canManage && (
          <AdminManagerView
            sectors={sectors}
            onAddSector={n => setSectors([...sectors, { id: Date.now().toString(), name: n, streets: [], porteurIds: [] }])}
            onUpdateSector={handleUpdateSector}
            onDeleteSector={handleDeleteSector}
            onAddStreetsToSector={(id, sts) => setSectors(sectors.map(s => s.id === id ? { ...s, streets: [...new Set([...s.streets, ...sts])] } : s))}
            teamMembers={teamMembers}
            onAddTeamMember={m => setTeamMembers([...teamMembers, m])}
            onUpdateTeamMember={m => setTeamMembers(teamMembers.map(tm => tm.id === m.id ? m : tm))}
            onDeleteTeamMember={id => { setTeamMembers(teamMembers.filter(m => m.id !== id)); setSectors(sectors.map(s => ({ ...s, responsableId: s.responsableId === id ? undefined : s.responsableId, porteurIds: s.porteurIds.filter(pid => pid !== id) }))); }}
            addresses={addresses}
            sales={sales}
            theme={theme}
            onThemeToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            user={currentUser}
          />
        )}
      </div>
      {selectedAddress && <SaleModal address={selectedAddress} user={currentUser} onClose={() => setSelectedAddress(null)} onSave={handleSaleSave} onUpdateStatus={s => { setAddresses(addresses.map(a => a.id === selectedAddress.id ? { ...a, status: s } : a)); setSelectedAddress(null); }} />}
      <div className="fixed bottom-8 left-6 right-6 z-[1100]">
        <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 h-20 rounded-[32px] shadow-2xl flex items-center justify-around px-2">
          <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center justify-center w-14 h-14 ${activeTab === 'map' ? 'text-fire-orange scale-110' : 'text-slate-300 dark:text-slate-600'}`}><i className="fas fa-map-marked-alt text-xl mb-1"></i><span className="text-[7px] font-black uppercase">Carte</span></button>
          <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center justify-center w-14 h-14 ${activeTab === 'list' ? 'text-fire-orange scale-110' : 'text-slate-300 dark:text-slate-600'}`}><i className="fas fa-route text-xl mb-1"></i><span className="text-[7px] font-black uppercase">Rues</span></button>
          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center justify-center w-14 h-14 ${activeTab === 'stats' ? 'text-fire-orange scale-110' : 'text-slate-300 dark:text-slate-600'}`}><i className="fas fa-chart-line text-xl mb-1"></i><span className="text-[7px] font-black uppercase">Données</span></button>
          {canManage && <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center justify-center w-14 h-14 ${activeTab === 'admin' ? 'text-fire-orange scale-110' : 'text-slate-300 dark:text-slate-600'}`}><i className="fas fa-users-cog text-xl mb-1"></i><span className="text-[7px] font-black uppercase">{currentUser.role === UserRole.ADMIN ? 'Gestion' : 'Secteur'}</span></button>}
        </nav>
      </div>
    </div>
  );
};

export default App;