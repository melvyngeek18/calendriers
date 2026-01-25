import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
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
const createCustomIcon = (status: VisitStatus, label: string) => {
  const color = STATUS_COLORS[status];
  const html = `
    <div style="
      background-color: ${color};
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: 2px solid white;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: 'Inter', sans-serif;
      overflow: hidden;
    ">
      <span style="font-size: 10px; font-weight: 900; line-height: 1;">${label}</span>
      <div style="font-size: 7px; opacity: 0.8; margin-top: 1px;">
        <i class="fas ${status === VisitStatus.DONE ? 'fa-check' : status === VisitStatus.ABSENT ? 'fa-clock' : status === VisitStatus.REFUSED ? 'fa-times' : 'fa-home'}"></i>
      </div>
    </div>
  `;
  return L.divIcon({
    html: html,
    className: 'custom-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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
      onLogin({ id: Date.now().toString(), rescueCenter, lastName, firstName, role, rescueCenterLogo: logo });
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
        <div className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 p-1">
           <img 
             src="https://images.squarespace-cdn.com/content/v1/5f3851b2c589b94046166412/1653526645395-N1R44G19XQY1A1I3E3X9/SC_Logo_Transparent.png" 
             className="w-full h-full object-contain" 
             alt="SC Logo" 
           />
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
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Accès Caserne</p>
          </div>
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[32px] p-6 shadow-2xl mb-6 transform transition-all hover:scale-[1.02]">
            <div className="flex flex-col items-center">
              <div className="w-fit max-w-[200px] h-fit max-h-[120px] rounded-[32px] bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-xl overflow-hidden mb-4 p-4 flex items-center justify-center">
                {existingProfile.rescueCenterLogo ? <img src={existingProfile.rescueCenterLogo} className="w-full h-full object-contain" alt="Logo" /> : <div className="w-16 h-16 flex items-center justify-center text-3xl text-slate-300"><i className="fas fa-building"></i></div>}
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">{existingProfile.firstName} {existingProfile.lastName}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white ${existingProfile.role === UserRole.ADMIN ? 'bg-red-600 shadow-lg shadow-red-900/20' : existingProfile.role === UserRole.RESPONSABLE ? 'bg-fire-orange shadow-lg shadow-fire-orange/20' : 'bg-blue-600 shadow-lg shadow-blue-900/20'}`}>{existingProfile.role}</span>
              </div>
            </div>
            <div className="mt-8 space-y-4">
              {existingProfile.role === UserRole.ADMIN ? (
                <div className="animate-fade-in">
                  <label className="block text-center text-slate-400 text-[9px] font-black uppercase tracking-widest mb-2">Sécurité Admin</label>
                  <input type="password" autoFocus placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-center font-bold text-slate-900 dark:text-white focus:outline-none focus:border-fire-orange" />
                  <button onClick={handleAdminAuth} className="w-full mt-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-black uppercase text-sm tracking-wide shadow-lg">Se Connecter</button>
                </div>
              ) : (
                <button onClick={() => onLogin(existingProfile)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-sm tracking-wide shadow-lg">Ouvrir Session</button>
              )}
            </div>
          </div>
          <button onClick={() => { setIsCreatingNew(true); setPassword(''); setLogo(undefined); }} className="w-full text-center text-slate-400 hover:text-fire-orange text-[10px] font-black uppercase tracking-widest transition-colors">Changer de Profil</button>
        </div>
        <Copyright />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col p-8 justify-center animate-fade-in overflow-y-auto no-scrollbar relative">
      <div className="mb-6 text-center relative z-10">
        <div 
          onClick={() => role === UserRole.ADMIN && fileInputRef.current?.click()} 
          className={`w-fit max-w-[200px] min-w-[100px] h-fit max-h-[160px] min-h-[100px] bg-white/20 dark:bg-slate-900/50 backdrop-blur-xl border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[32px] mx-auto flex items-center justify-center shadow-2xl mb-4 overflow-hidden relative p-4 group transition-all ${role === UserRole.ADMIN ? 'cursor-pointer hover:border-fire-orange' : 'cursor-default opacity-50'}`}
        >
          {logo ? (
            <img src={logo} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2">
               <i className={`fas ${role === UserRole.ADMIN ? 'fa-camera' : 'fa-lock'} text-slate-500 text-2xl group-hover:scale-110 transition-transform`}></i>
               <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">
                 {role === UserRole.ADMIN ? 'Ajouter Logo' : 'Admin requis'}
               </span>
            </div>
          )}
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
        </div>
        <h1 className="text-4xl font-black italic text-slate-900 dark:text-white uppercase tracking-tighter">Initialisation</h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Étape de configuration</p>
      </div>
      
      <form onSubmit={handleCreateSubmit} className="space-y-3 max-w-sm mx-auto w-full relative z-10">
        <input required placeholder="Centre de Secours" value={rescueCenter} onChange={(e) => setRescueCenter(e.target.value)} className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl py-3.5 px-6 focus:outline-none text-sm font-bold shadow-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input required placeholder="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl py-3.5 px-6 focus:outline-none text-sm font-bold shadow-sm" />
          <input required placeholder="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl py-3.5 px-6 focus:outline-none text-sm font-bold shadow-sm" />
        </div>
        
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 relative flex h-14 items-center shadow-inner mt-2">
          <div className="absolute h-[calc(100%-12px)] w-[31%] bg-fire-orange rounded-xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-[0_0_15px_rgba(249,115,22,0.4)]" style={{ transform: `translateX(${roleIndex * 112}%)` }}></div>
          <button type="button" onClick={() => { setRole(UserRole.PORTEUR); setLogo(undefined); }} className={`flex-1 z-10 text-[8px] font-black uppercase tracking-wider transition-all ${role === UserRole.PORTEUR ? 'text-white scale-110' : 'text-slate-500'}`}>Porteur</button>
          <button type="button" onClick={() => { setRole(UserRole.RESPONSABLE); setLogo(undefined); }} className={`flex-1 z-10 text-[8px] font-black uppercase tracking-wider transition-all ${role === UserRole.RESPONSABLE ? 'text-white scale-110' : 'text-slate-500'}`}>Resp.</button>
          <button type="button" onClick={() => setRole(UserRole.ADMIN)} className={`flex-1 z-10 text-[8px] font-black uppercase tracking-wider transition-all ${role === UserRole.ADMIN ? 'text-white scale-110' : 'text-slate-500'}`}>Admin</button>
        </div>

        {role === UserRole.ADMIN && (
          <div className="animate-fade-in-down mt-2">
            <input type="password" required placeholder="Définir mot de passe Admin" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-100 rounded-2xl py-3.5 px-6 focus:outline-none text-sm font-bold shadow-inner" />
          </div>
        )}
        
        <button type="submit" className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-950 py-4.5 rounded-2xl font-black italic uppercase text-lg shadow-2xl mt-4 active:scale-95 transition-transform">
          Valider Profil
        </button>
      </form>
      <Copyright />
    </div>
  );
};

// --- No Sector View ---
const NoSectorView: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950">
    <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-xl animate-pulse">
      <i className="fas fa-user-lock"></i>
    </div>
    <h1 className="text-3xl font-black italic text-slate-900 dark:text-white uppercase tracking-tighter mb-4">Accès Restreint</h1>
    <p className="text-slate-500 text-sm font-bold leading-relaxed max-w-xs mb-10 uppercase">
      Aucun secteur ne vous a été attribué par l'administrateur. Veuillez contacter votre responsable pour démarrer votre tournée.
    </p>
    <button onClick={onLogout} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-2xl font-black uppercase italic tracking-widest text-sm shadow-xl active:scale-95 transition-transform">
      Changer de Profil
    </button>
  </div>
);

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
  user: User,
  onResetAllData: () => void
}> = ({ sectors, onAddSector, onUpdateSector, onDeleteSector, onAddStreetsToSector, teamMembers, onAddTeamMember, onUpdateTeamMember, onDeleteTeamMember, addresses, sales, theme, onThemeToggle, user, onResetAllData }) => {
  const [activeTab, setActiveTab] = useState<'sectors' | 'team' | 'settings'>('sectors');
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
        <button onClick={() => setActiveTab('sectors')} className={`text-[10px] font-black uppercase tracking-widest pb-2 ${activeTab === 'sectors' ? 'text-fire-orange border-b-2 border-fire-orange' : 'text-slate-400'}`}>Secteurs</button>
        <button onClick={() => setActiveTab('team')} className={`text-[10px] font-black uppercase tracking-widest pb-2 ${activeTab === 'team' ? 'text-fire-orange border-b-2 border-fire-orange' : 'text-slate-400'}`}>Effectifs</button>
        <button onClick={() => setActiveTab('settings')} className={`text-[10px] font-black uppercase tracking-widest pb-2 ${activeTab === 'settings' ? 'text-fire-orange border-b-2 border-fire-orange' : 'text-slate-400'}`}>Paramètres</button>
      </div>

      {activeTab === 'settings' && (
        <div className="space-y-6 animate-fade-in">
           <div className="bg-white dark:bg-slate-900/40 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
             <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
             <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                  <i className="fas fa-radiation"></i>
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Zone Critique</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Actions irréversibles</p>
                </div>
             </div>
             <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed mb-8 italic">
               La réinitialisation supprimera définitivement tous les secteurs, les membres d'équipes, les adresses scannées et les ventes enregistrées sur cet appareil. Cette action est immédiate.
             </p>
             <button 
               onClick={() => { if(confirm("Êtes-vous ABSOLUMENT sûr ? Cette action est irréversible et supprimera TOUTES les données de l'application.")) onResetAllData(); }} 
               className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl font-black uppercase italic tracking-tighter text-sm shadow-xl shadow-red-900/20 flex items-center justify-center gap-3 transition-all active:scale-95"
             >
               <i className="fas fa-trash-alt"></i>
               RÉINITIALISER TOUT
             </button>
           </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900/40 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl">
            <h3 className="text-slate-500 text-[10px] font-black uppercase mb-4 italic">Ajouter un Effectif</h3>
            <form onSubmit={e => { e.preventDefault(); onAddTeamMember({ id: Date.now().toString(), firstName: newMemberFN, lastName: newMemberLN, role: newMemberRole, rescueCenter: user.rescueCenter }); setNewMemberFN(''); setNewMemberLN(''); }} className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input required placeholder="Nom" value={newMemberLN} onChange={e => setNewMemberLN(e.target.value)} className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" />
                <input required placeholder="Prénom" value={newMemberFN} onChange={e => setNewMemberFN(e.target.value)} className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold" />
              </div>
              <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value as UserRole)} className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold">
                <option value={UserRole.PORTEUR}>Porteur</option>
                <option value={UserRole.RESPONSABLE}>Responsable</option>
                <option value={UserRole.ADMIN}>Administrateur</option>
              </select>
              <button type="submit" className="bg-fire-orange text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg shadow-fire-orange/20 italic">Enregistrer Effectif</button>
            </form>
          </div>
          <div className="space-y-3">
            {teamMembers.map(m => (
              <div key={m.id} className="bg-white dark:bg-slate-900/40 p-4 rounded-[24px] border border-slate-200 dark:border-slate-800 flex flex-col gap-4 shadow-lg">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black italic text-slate-400 border border-slate-200 dark:border-slate-700">{m.firstName[0]}{m.lastName[0]}</div>
                    <div>
                      <h4 className="font-black italic uppercase tracking-tighter text-slate-900 dark:text-white text-md">{m.firstName} {m.lastName}</h4>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full text-white ${m.role === UserRole.ADMIN ? 'bg-red-600' : m.role === UserRole.RESPONSABLE ? 'bg-fire-orange' : 'bg-blue-600'}`}>{m.role}</span>
                    </div>
                  </div>
                  <button onClick={() => onDeleteTeamMember(m.id)} className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-500 active:scale-90 transition-transform"><i className="fas fa-trash text-[10px]"></i></button>
                </div>
                
                {m.role !== UserRole.ADMIN && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/50">
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-2">Secteur Désigné</label>
                    <select 
                      value={m.sectorId || ''} 
                      onChange={e => onUpdateTeamMember({ ...m, sectorId: e.target.value || undefined })}
                      className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300"
                    >
                      <option value="">-- Aucun secteur --</option>
                      {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
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
              <input value={newSectorName} onChange={e => setNewSectorName(e.target.value)} className="flex-1 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 dark:text-white shadow-inner" placeholder="Nom du secteur..." />
              <button onClick={() => { if(newSectorName){ onAddSector(newSectorName); setNewSectorName(''); }}} className="bg-fire-orange text-white px-5 rounded-xl font-bold shadow-lg shadow-fire-orange/20"><i className="fas fa-plus"></i></button>
            </div>
          </div>

          <div className="space-y-4">
            {sectors.map(sector => {
              const stats = getSectorStats(sector);
              const responsible = teamMembers.find(m => m.id === sector.responsableId);
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
                          <button onClick={() => { setEditingSectorId(sector.id); setTempSectorName(sector.name); }} className="text-slate-400 hover:text-fire-orange transition-colors"><i className="fas fa-pen text-xs"></i></button>
                        </div>
                      )}
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Responsable : <span className="text-fire-orange">{responsible ? `${responsible.firstName} ${responsible.lastName}` : "Non assigné"}</span>
                      </p>
                    </div>
                    <button 
                      onClick={() => { if(confirm("Supprimer ce secteur et toutes ses données ?")) onDeleteSector(sector.id); }} 
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-red-50 dark:bg-red-900/20 text-red-500 active:scale-90 hover:bg-red-100 dark:hover:bg-red-900/40 shadow-sm"
                      title="Supprimer ce secteur"
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
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Affecter Responsable</label>
                      <select value={sector.responsableId || ''} onChange={e => handleAssignResponsable(sector.id, e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold shadow-sm">
                        <option value="">-- Aucun --</option>
                        {teamMembers.filter(m => m.role === UserRole.RESPONSABLE || m.role === UserRole.ADMIN).map(m => (
                          <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.role})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Rues du Secteur ({sector.streets.length})</label>
                      <div className="flex gap-2">
                        <input list={`streets-dl-${sector.id}`} value={streetInputs[sector.id] || ''} onChange={e => setStreetInputs({ ...streetInputs, [sector.id]: e.target.value })} className="flex-1 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-inner" placeholder="Rue de..." />
                        <datalist id={`streets-dl-${sector.id}`}>{availableStreets.map(st => <option key={st} value={st} />)}</datalist>
                        <button onClick={() => handleAddStreets(sector.id)} className="bg-blue-600 text-white px-4 rounded-xl font-bold text-xs shadow-lg shadow-blue-900/20">OK</button>
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
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [sectorSearch, setSectorSearch] = useState('');

  const filteredSectors = useMemo(() => {
    return sectors.filter(s => s.name.toLowerCase().includes(sectorSearch.toLowerCase()));
  }, [sectors, sectorSearch]);

  const selectedSectorName = useMemo(() => {
    if (!selectedSecId) return "Tous les secteurs";
    return sectors.find(s => s.id === selectedSecId)?.name || "Inconnu";
  }, [selectedSecId, sectors]);

  const filteredAddresses = useMemo(() => {
    let res = addresses;
    const currentSectorId = isGlobalAdmin ? selectedSecId : user.sectorId;
    if (currentSectorId) {
      const sector = sectors.find(s => s.id === currentSectorId);
      if (sector) {
        const streets = new Set(sector.streets);
        res = res.filter(a => streets.has(a.streetName));
      }
    } else if (!isGlobalAdmin) {
      return [];
    }
    if (filter !== 'ALL') res = res.filter(a => a.status === filter);
    return res.sort((a, b) => a.streetName.localeCompare(b.streetName));
  }, [addresses, sectors, selectedSecId, user.sectorId, filter, isGlobalAdmin]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-6 pb-2 space-y-4 relative">
        <h1 className="text-4xl font-black italic text-slate-900 dark:text-white uppercase tracking-tighter">Rues</h1>
        
        {isGlobalAdmin && (
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setIsSelectorOpen(true)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 py-4 px-5 rounded-[24px] flex justify-between items-center group transition-all active:scale-[0.98] shadow-sm"
            >
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Filtrer par secteur</span>
                <span className="text-xs font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">{selectedSectorName}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-fire-orange/10 flex items-center justify-center text-fire-orange group-hover:bg-fire-orange group-hover:text-white transition-all shadow-inner">
                 <i className="fas fa-search-location text-sm"></i>
              </div>
            </button>
          </div>
        )}

        <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setFilter('ALL')} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${filter === 'ALL' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'bg-slate-100 dark:bg-slate-900 text-slate-400 shadow-sm'}`}>Tout</button>
          {[VisitStatus.TODO, VisitStatus.DONE, VisitStatus.ABSENT, VisitStatus.REFUSED].map(s => <button key={s} onClick={() => setFilter(s)} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${filter === s ? 'text-white shadow-md' : 'text-slate-400 bg-slate-100 dark:bg-slate-900 shadow-sm'}`} style={filter === s ? {backgroundColor: STATUS_COLORS[s]} : {}}>{STATUS_LABELS[s]}</button>)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-2 pt-0 pb-32">
        {filteredAddresses.length > 0 ? filteredAddresses.map(a => (
          <div key={a.id} onClick={() => onMarkerClick(a)} className="bg-white dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-lg active:scale-95 transition-transform group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-transform group-hover:rotate-12" style={{ borderColor: STATUS_COLORS[a.status] + '40', color: STATUS_COLORS[a.status] }}>
                <i className={`fas ${a.status === VisitStatus.DONE ? 'fa-check' : a.status === VisitStatus.ABSENT ? 'fa-clock' : a.status === VisitStatus.REFUSED ? 'fa-times' : 'fa-home'}`}></i>
              </div>
              <div>
                <h3 className="font-black text-sm italic uppercase tracking-tighter text-slate-900 dark:text-white leading-tight">{a.streetNumber} {a.streetName}</h3>
                <p className="text-slate-400 text-[8px] font-black uppercase mt-0.5">{STATUS_LABELS[a.status]}</p>
              </div>
            </div>
            <i className="fas fa-chevron-right text-slate-300 group-hover:text-fire-orange transition-colors text-[10px]"></i>
          </div>
        )) : (
          <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
            <i className="fas fa-map-signs text-5xl mb-4 text-slate-300"></i>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] max-w-xs">Aucune adresse trouvée pour cette sélection</p>
          </div>
        )}
      </div>

      {/* Improved Sector Selector Overlay */}
      {isSelectorOpen && (
        <div className="fixed inset-0 z-[6000] flex flex-col bg-slate-50 dark:bg-slate-950 animate-fade-in backdrop-blur-3xl overflow-hidden">
          <div className="p-6 pb-2 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
            <div>
               <h2 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white leading-none">Secteurs</h2>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Sélection de zone</p>
            </div>
            <button onClick={() => setIsSelectorOpen(false)} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center text-slate-400 active:scale-90 transition-all border border-slate-100 dark:border-slate-700">
               <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="p-6 pt-4 sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-inner ring-4 ring-slate-100/50 dark:ring-slate-800/20">
               <i className="fas fa-search text-fire-orange text-sm"></i>
               <input 
                 autoFocus 
                 placeholder="Rechercher par nom..." 
                 value={sectorSearch} 
                 onChange={e => setSectorSearch(e.target.value)} 
                 className="bg-transparent border-none text-sm font-bold text-slate-900 dark:text-white focus:outline-none flex-1"
               />
               {sectorSearch && (
                 <button onClick={() => setSectorSearch('')} className="text-slate-300 hover:text-slate-500 transition-colors">
                    <i className="fas fa-times-circle"></i>
                 </button>
               )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-3 pb-20 mt-2">
            {!sectorSearch && (
              <button 
                onClick={() => { setSelectedSecId(null); setIsSelectorOpen(false); }}
                className={`w-full p-5 rounded-[28px] border text-left flex justify-between items-center transition-all active:scale-[0.98] ${!selectedSecId ? 'bg-fire-orange border-fire-orange shadow-xl shadow-fire-orange/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'}`}
              >
                <div className="flex flex-col">
                  <span className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${!selectedSecId ? 'text-white/60' : 'text-slate-400'}`}>Toutes les zones</span>
                  <span className={`text-md font-black uppercase italic tracking-tighter ${!selectedSecId ? 'text-white' : 'text-slate-900 dark:text-white'}`}>Tout le centre de secours</span>
                </div>
                {!selectedSecId && <i className="fas fa-check-circle text-white text-lg"></i>}
              </button>
            )}
            
            {filteredSectors.length > 0 ? filteredSectors.map(s => (
              <button 
                key={s.id}
                onClick={() => { setSelectedSecId(s.id); setIsSelectorOpen(false); }}
                className={`w-full p-5 rounded-[28px] border text-left flex justify-between items-center transition-all active:scale-[0.98] ${selectedSecId === s.id ? 'bg-fire-orange border-fire-orange shadow-xl shadow-fire-orange/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'}`}
              >
                <div className="flex flex-col">
                  <span className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${selectedSecId === s.id ? 'text-white/60' : 'text-slate-400'}`}>{s.streets.length} rues répertoriées</span>
                  <span className={`text-md font-black uppercase italic tracking-tighter ${selectedSecId === s.id ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{s.name}</span>
                </div>
                {selectedSecId === s.id && <i className="fas fa-check-circle text-white text-lg"></i>}
              </button>
            )) : (
              <div className="py-20 flex flex-col items-center text-center opacity-30">
                <i className="fas fa-ghost text-4xl mb-4"></i>
                <p className="text-[10px] font-black uppercase tracking-widest">Aucun secteur correspondant</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Map Interaction Handler ---
const MapEvents = ({ onScan }: { onScan: (center: L.LatLng) => void }) => {
  useMapEvents({
    moveend: (e) => {
      // Optionnel: on pourrait scanner automatiquement ici
    }
  });
  return null;
};

// --- Map View ---
const MapView: React.FC<{ addresses: AddressPoint[], onMarkerClick: (addr: AddressPoint) => void, onAddAddresses: (addrs: AddressPoint[]) => void, theme: 'light' | 'dark' }> = ({ addresses, onMarkerClick, onAddAddresses, theme }) => {
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([48.8566, 2.3522]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 3) { setResults([]); return; }
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`);
    const data = await res.json();
    setResults(data.features || []);
  };

  const selectResult = (f: any) => {
    const [lng, lat] = f.geometry.coordinates;
    const { housenumber, street, label } = f.properties;
    setMapCenter([lat, lng]);
    setResults([]);
    setQuery(label);
    const existing = addresses.find(a => a.lat === lat && a.lng === lng);
    if (!existing) {
      onAddAddresses([{ id: Date.now().toString(), lat, lng, streetNumber: housenumber || '?', streetName: street || '?', status: VisitStatus.TODO }]);
    } else {
      onMarkerClick(existing);
    }
  };

  const handleScanZone = async () => {
    if (!mapRef.current) return;
    setIsScanning(true);
    const center = mapRef.current.getCenter();
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lon=${center.lng}&lat=${center.lat}&limit=30`);
      const data = await res.json();
      
      const newAddresses: AddressPoint[] = data.features.map((f: any) => ({
        id: f.properties.id || Date.now().toString() + Math.random(),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        streetNumber: f.properties.housenumber || '?',
        streetName: f.properties.street || '?',
        status: VisitStatus.TODO
      })).filter((newA: AddressPoint) => !addresses.some(oldA => oldA.lat === newA.lat && oldA.lng === newA.lng));

      if (newAddresses.length > 0) {
        onAddAddresses(newAddresses);
      }
    } catch (e) {
      console.error("Erreur scan BAN:", e);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex-1 relative overflow-hidden">
      <div className="absolute top-6 left-6 right-6 z-[1000] flex flex-col gap-2">
        <div className="bg-white/80 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[28px] shadow-2xl flex items-center px-5 py-3 transition-all hover:bg-white dark:hover:bg-slate-900">
          <i className="fas fa-search text-slate-400 mr-3 text-sm"></i>
          <input type="text" placeholder="Rechercher une adresse..." value={query} onChange={e => handleSearch(e.target.value)} className="bg-transparent border-none text-slate-900 dark:text-white focus:outline-none flex-1 text-xs font-bold" />
        </div>
        {results.length > 0 && (
          <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50">
            {results.map((f, i) => (
              <button key={i} onClick={() => selectResult(f)} className="w-full px-5 py-4 text-left hover:bg-fire-orange/5 flex items-center gap-3 active:bg-slate-100 dark:active:bg-slate-800 transition-colors">
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

      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1000]">
         <button 
           onClick={handleScanZone} 
           disabled={isScanning}
           className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-6 py-3 rounded-full shadow-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 active:scale-95 transition-all group overflow-hidden relative shadow-inner"
         >
            <div className={`absolute inset-0 bg-fire-orange/10 transition-transform duration-1000 ${isScanning ? 'translate-x-0' : '-translate-x-full'}`}></div>
            <i className={`fas ${isScanning ? 'fa-spinner fa-spin' : 'fa-crosshairs'} text-fire-orange`}></i>
            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{isScanning ? 'Scan en cours...' : 'Scanner cette zone'}</span>
         </button>
      </div>

      <MapContainer 
        center={mapCenter} 
        zoom={17} 
        style={{ height: '100%', width: '100%' }} 
        zoomControl={false}
        ref={mapRef as any}
      >
        <TileLayer url={theme === 'dark' ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"} />
        {addresses.map(a => <Marker key={a.id} position={[a.lat, a.lng]} icon={createCustomIcon(a.status, a.streetNumber)} eventHandlers={{ click: () => onMarkerClick(a) }} />)}
        {userLoc && <Marker position={userLoc} icon={L.divIcon({ html: '<div class="w-6 h-6 bg-blue-500 rounded-full border-4 border-white shadow-xl animate-pulse"></div>', iconSize: [24, 24], iconAnchor: [12, 12] })} />}
        <MapController center={mapCenter} zoom={17} userLoc={userLoc} />
        <MapEvents onScan={() => {}} />
      </MapContainer>
      <button onClick={() => navigator.geolocation.getCurrentPosition(pos => { setUserLoc([pos.coords.latitude, pos.coords.longitude]); setMapCenter([pos.coords.latitude, pos.coords.longitude]); })} className="absolute bottom-32 right-6 w-14 h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-2xl z-[1000] flex items-center justify-center text-slate-950 dark:text-white active:scale-90 transition-transform"><i className="fas fa-location-arrow text-xl"></i></button>
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
          <div className="w-12 h-12 bg-fire-orange rounded-2xl flex items-center justify-center text-white text-xl shadow-lg rotate-3 shadow-fire-orange/20"><i className="fas fa-chart-pie"></i></div>
          <div>
            <h1 className="text-3xl font-black italic text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Synthèse</h1>
            <p className="text-fire-orange text-[10px] font-black uppercase tracking-[0.2em]">{user.firstName} {user.lastName}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-[8px] font-black text-fire-orange bg-fire-orange/10 px-3 py-1.5 rounded-full uppercase tracking-widest">{scope}</div>
          <button 
            onClick={onEditProfile}
            className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-fire-orange/10 transition-colors px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 active:scale-95 shadow-sm"
          >
            <i className="fas fa-user-edit text-[10px] text-slate-500"></i>
            <span className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-400">Profil</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center">
          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Fait</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{done}</p>
        </div>
        <div className="bg-white dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center">
          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Total</p>
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
          <button onClick={async () => { setLoading(true); setReport(await generateDailyReport(filteredSales, filteredAddresses)); setLoading(false); }} disabled={!isOnline || loading} className={`text-[9px] font-black px-5 py-2.5 rounded-full uppercase tracking-widest shadow-md transition-all ${isOnline ? 'bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 active:scale-95' : 'bg-slate-100 text-slate-400 opacity-50'}`}>
            {loading ? 'Analyse...' : 'Générer'}
          </button>
        </div>
        {report ? <div className="text-slate-700 dark:text-slate-300 text-sm italic leading-relaxed bg-slate-50 dark:bg-slate-950/50 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800/50 shadow-inner">{report}</div> : <p className="text-center text-slate-400 text-[10px] uppercase font-bold py-8">Cliquez pour analyser vos performances</p>}
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
  const [sectors, setSectors] = useState<Sector[]>(() => JSON.parse(localStorage.getItem('firecal_sectors') || '[]'));
  const [teamMembers, setTeamMembers] = useState<User[]>(() => JSON.parse(localStorage.getItem('firecal_team') || '[]'));
  const [selectedAddress, setSelectedAddress] = useState<AddressPoint | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' | 'error' } | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.role !== UserRole.ADMIN) {
      const match = teamMembers.find(m => 
        m.firstName.toLowerCase() === currentUser.firstName.toLowerCase() && 
        m.lastName.toLowerCase() === currentUser.lastName.toLowerCase()
      );
      if (match && match.sectorId !== currentUser.sectorId) {
        const updated = { ...currentUser, sectorId: match.sectorId };
        setCurrentUser(updated);
        localStorage.setItem('firecal_user', JSON.stringify(updated));
      }
    }
  }, [teamMembers, currentUser]);

  useEffect(() => { if(currentUser) localStorage.setItem('firecal_user', JSON.stringify(currentUser)); }, [currentUser]);
  useEffect(() => localStorage.setItem('firecal_addresses', JSON.stringify(addresses)), [addresses]);
  useEffect(() => localStorage.setItem('firecal_sales', JSON.stringify(sales)), [sales]);
  useEffect(() => localStorage.setItem('firecal_sectors', JSON.stringify(sectors)), [sectors]);
  useEffect(() => localStorage.setItem('firecal_team', JSON.stringify(teamMembers)), [teamMembers]);
  useEffect(() => localStorage.setItem('firecal_theme', theme), [theme]);
  useEffect(() => { document.documentElement.className = theme; }, [theme]);

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
        setToast({ message: "Synchronisation réussie : Données transmises au serveur", type: 'success' });
      };
      sync();
    }
  }, [isOnline, sales]);

  const handleSaleSave = (s: Sale, st: VisitStatus) => {
    setSales([...sales, s]);
    setAddresses(addresses.map(a => a.id === s.addressId ? { ...a, status: s } : a));
    setSelectedAddress(null);
  };

  const handleUpdateSector = (s: Sector) => setSectors(sectors.map(sec => sec.id === s.id ? s : sec));
  
  const handleDeleteSector = (id: string) => {
    setSectors(prev => prev.filter(s => s.id !== id));
    setTeamMembers(prev => prev.map(m => m.sectorId === id ? { ...m, sectorId: undefined } : m));
    if (currentUser?.sectorId === id) {
       const updatedUser = { ...currentUser, sectorId: undefined };
       setCurrentUser(updatedUser);
       localStorage.setItem('firecal_user', JSON.stringify(updatedUser));
    }
    setToast({ message: "Secteur supprimé", type: 'info' });
  };

  const handleResetAllData = () => {
    localStorage.clear();
    setAddresses(MOCK_ADDRESSES);
    setSales([]);
    setSectors([]);
    setTeamMembers([]);
    setCurrentUser(null);
    setToast({ message: "Application réinitialisée intégralement", type: 'success' });
  };

  if (!currentUser) return <LoginView onLogin={setCurrentUser} sectors={sectors} />;

  const hasSector = currentUser.role === UserRole.ADMIN || currentUser.sectorId;
  if (!hasSector) return <NoSectorView onLogout={() => { localStorage.removeItem('firecal_user'); setCurrentUser(null); }} />;

  const canManage = currentUser.role === UserRole.ADMIN;

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className={`fixed top-0 left-0 right-0 z-[5000] h-1 bg-fire-orange transition-all duration-1000 ${isSyncing ? 'opacity-100 animate-pulse' : 'opacity-0'}`}></div>
      
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'map' && <MapView addresses={addresses} onMarkerClick={setSelectedAddress} onAddAddresses={newAddrs => setAddresses(prev => [...prev, ...newAddrs])} theme={theme} />}
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
            onResetAllData={handleResetAllData}
          />
        )}
      </div>
      {selectedAddress && <SaleModal address={selectedAddress} user={currentUser} onClose={() => setSelectedAddress(null)} onSave={handleSaleSave} onUpdateStatus={s => { setAddresses(addresses.map(a => a.id === selectedAddress.id ? { ...a, status: s } : a)); setSelectedAddress(null); }} />}
      
      <div className="fixed bottom-8 left-6 right-6 z-[1100]">
        <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 h-20 rounded-[32px] shadow-2xl flex items-center justify-around px-2 overflow-hidden shadow-black/20">
          <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 ${activeTab === 'map' ? 'text-fire-orange scale-110 drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]' : 'text-slate-300 dark:text-slate-600'}`}><i className="fas fa-map-marked-alt text-xl mb-1"></i><span className="text-[7px] font-black uppercase tracking-widest">Carte</span></button>
          <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 ${activeTab === 'list' ? 'text-fire-orange scale-110 drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]' : 'text-slate-300 dark:text-slate-600'}`}><i className="fas fa-route text-xl mb-1"></i><span className="text-[7px] font-black uppercase tracking-widest">Rues</span></button>
          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 ${activeTab === 'stats' ? 'text-fire-orange scale-110 drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]' : 'text-slate-300 dark:text-slate-600'}`}><i className="fas fa-chart-line text-xl mb-1"></i><span className="text-[7px] font-black uppercase tracking-widest">Synthèse</span></button>
          {canManage && (
            <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 ${activeTab === 'admin' ? 'text-fire-orange scale-110 drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]' : 'text-slate-300 dark:text-slate-600'}`}><i className="fas fa-users-cog text-xl mb-1"></i><span className="text-[7px] font-black uppercase tracking-widest">Gestion</span></button>
          )}
        </nav>
      </div>
    </div>
  );
};

export default App;