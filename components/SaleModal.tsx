import React, { useState, useEffect } from 'react';
import { AddressPoint, PaymentMethod, Sale, VisitStatus, ReceiptMethod, User } from '../types';
import { generateReceiptContent } from '../services/geminiService';

interface SaleModalProps {
  address: AddressPoint;
  user: User;
  onClose: () => void;
  onSave: (sale: Sale, status: VisitStatus) => void;
  onUpdateStatus: (status: VisitStatus) => void;
}

const SaleModal: React.FC<SaleModalProps> = ({ address, user, onClose, onSave, onUpdateStatus }) => {
  const [visitMode, setVisitMode] = useState<'DONATION' | 'ABSENT' | 'REFUSED'>('DONATION');
  const [amount, setAmount] = useState<number>(10);
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [donatorName, setDonatorName] = useState('');
  const [receiptMethod, setReceiptMethod] = useState<ReceiptMethod>('EMAIL');
  
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSuccessMode, setIsSuccessMode] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [isLoadingMessage, setIsLoadingMessage] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const handleQuickAmount = (val: number) => setAmount(val);

  const isValidEmail = (e: string) => e.trim().includes('@') && e.trim().includes('.');
  const isValidPhone = (p: string) => p.trim().length >= 10;
  
  // Le nom devient facultatif pour le mode PAPIER ou si l'utilisateur ne le saisit pas (Anonyme)
  // On bloque la validation seulement si un mode numérique est choisi sans les coordonnées nécessaires
  const isFormValid = 
    ((receiptMethod === 'EMAIL' && isValidEmail(email)) || 
     (receiptMethod === 'SMS' && isValidPhone(phone)) ||
     (receiptMethod === 'PAPER')) &&
    (amount > 0);

  const handleAction = async () => {
    if (!isFormValid) return;
    
    // Si c'est papier, on valide directement sans aperçu IA pour gagner du temps
    if (receiptMethod === 'PAPER') {
      handleFinalSubmit();
      return;
    }

    // Sinon, on prépare l'aperçu IA
    setIsPreviewMode(true);
    
    if (isOnline) {
      setIsLoadingMessage(true);
      const mockSale: Sale = {
        id: 'preview',
        addressId: address.id,
        userId: user.id,
        amount,
        paymentMethod: method,
        timestamp: new Date().toISOString(),
        receiptSent: false,
        receiptMethod,
        donatorName: donatorName || 'Donateur Anonyme',
        donatorEmail: email,
        donatorPhone: phone
      };
      const msg = await generateReceiptContent(mockSale);
      setGeneratedMessage(msg);
      setIsLoadingMessage(false);
    } else {
      setGeneratedMessage("Merci pour votre générosité. Le reçu sera envoyé dès la prochaine synchronisation.");
    }
  };

  const handleFinalSubmit = () => {
    setIsSuccessMode(true);
    const newSale: Sale = {
      id: Date.now().toString(),
      addressId: address.id,
      userId: user.id,
      amount,
      paymentMethod: method,
      timestamp: new Date().toISOString(),
      receiptSent: receiptMethod !== 'PAPER' && isOnline,
      receiptMethod,
      donatorName: donatorName || undefined,
      donatorPhone: (receiptMethod === 'SMS' || phone) ? phone : undefined,
      donatorEmail: (receiptMethod === 'EMAIL' || email) ? email : undefined,
      synced: isOnline
    };
    
    setTimeout(() => {
      onSave(newSale, VisitStatus.DONE);
    }, 1500);
  };

  const handleMarkStatus = (status: VisitStatus) => {
    setIsSuccessMode(true);
    setTimeout(() => {
      onUpdateStatus(status);
    }, 1200);
  };

  if (isSuccessMode) {
    return (
      <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl animate-fade-in p-8">
        <div className="flex flex-col items-center text-center animate-scale-up">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-5xl mb-6 shadow-2xl animate-bounce ${
            visitMode === 'DONATION' ? 'bg-green-500 shadow-green-900/40' : 
            visitMode === 'ABSENT' ? 'bg-amber-500 shadow-amber-900/40' : 
            'bg-red-500 shadow-red-900/40'
          }`}>
            <i className={`fas ${visitMode === 'DONATION' ? 'fa-check' : visitMode === 'ABSENT' ? 'fa-clock' : 'fa-times'}`}></i>
          </div>
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-2">
            {visitMode === 'DONATION' ? 'Don Enregistré' : visitMode === 'ABSENT' ? 'Passage Noté' : 'Visite Refusée'}
          </h2>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
            {visitMode === 'DONATION' 
              ? (receiptMethod === 'PAPER' ? 'Opération terminée' : (isOnline ? 'Envoi du reçu en cours...' : 'Sauvegardé localement'))
              : (visitMode === 'ABSENT' ? 'Statut "Absent" mis à jour' : 'Statut "Refusé" mis à jour')}
          </p>
        </div>
      </div>
    );
  }

  if (isPreviewMode) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4">
        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] overflow-hidden flex flex-col shadow-2xl animate-scale-up border-4 border-white dark:border-slate-800">
          <div className="p-8 text-slate-900 dark:text-white bg-white dark:bg-slate-900 min-h-[400px]">
            <div className="flex justify-between items-start border-b dark:border-slate-800 pb-6 mb-6">
              <div className="flex items-center gap-3">
                {user.rescueCenterLogo ? (
                  <img src={user.rescueCenterLogo} alt="Logo" className="w-14 h-14 object-cover rounded-xl" />
                ) : (
                  <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center text-white"><i className="fas fa-fire-extinguisher"></i></div>
                )}
                <div>
                  <h3 className="font-black uppercase text-[10px] tracking-tighter leading-none">Amicale des Sapeurs-Pompiers</h3>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">{user.rescueCenter}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase">Reçu de don</p>
                <p className="text-[9px] font-bold">{new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <p className="text-[8px] font-black uppercase text-slate-400 mb-0.5">Donateur</p>
                <p className="text-sm font-black leading-tight">{donatorName || 'Donateur Anonyme'}</p>
                <p className="text-[10px] font-bold text-slate-600">{address.streetNumber} {address.streetName}</p>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-4 flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/50">
                  <span className="text-[10px] font-black uppercase text-slate-500">Montant du don</span>
                  <span className="text-2xl font-black text-red-600 italic">{amount} €</span>
                </div>
                <div className="px-4 py-2 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[9px] font-black uppercase text-slate-400">Mode de règlement</span>
                  <span className="text-[10px] font-bold">{method}</span>
                </div>
              </div>

              <div className="italic text-slate-600 dark:text-slate-400 text-xs leading-relaxed py-2 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-xl px-4">
                {isLoadingMessage ? (
                  <div className="flex gap-1 items-center justify-center py-4">
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-bounce delay-150"></span>
                  </div>
                ) : (
                  `« ${generatedMessage} »`
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800/50 p-6 flex flex-col gap-3">
             <button 
               onClick={handleFinalSubmit}
               disabled={isLoadingMessage}
               className={`w-full py-5 rounded-2xl font-black uppercase italic tracking-tighter shadow-xl transition-all flex items-center justify-center gap-2 ${
                 isOnline ? 'bg-red-600 text-white shadow-red-900/20' : 'bg-amber-600 text-white shadow-amber-900/20'
               } active:scale-95`}
             >
               <i className={`fas ${isOnline ? 'fa-paper-plane' : 'fa-cloud-upload-alt'}`}></i>
               {isOnline ? 'Confirmer l\'envoi' : 'Enregistrer (Offline)'}
             </button>
             <button onClick={() => setIsPreviewMode(false)} className="w-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">
               Modifier
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 w-full max-w-md rounded-t-[32px] p-6 shadow-2xl border-t border-slate-800 h-[94vh] flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">
              {address.streetNumber} {address.streetName}
            </h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest italic mt-1">Saisie de visite</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-800 rounded-full text-white flex items-center justify-center active:scale-90 transition-transform">
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {/* 3-way Switch for VISIT MODE */}
        <div className="bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700 flex h-14 items-center relative overflow-hidden shadow-inner mb-6">
          <div 
            className="absolute h-[calc(100%-12px)] w-[32%] bg-fire-orange rounded-xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-[0_0_15px_rgba(249,115,22,0.4)]"
            style={{ transform: `translateX(${visitMode === 'DONATION' ? '0%' : visitMode === 'ABSENT' ? '106%' : '212%'})` }}
          ></div>
          <button onClick={() => setVisitMode('DONATION')} className={`flex-1 z-10 flex items-center justify-center gap-1.5 transition-all duration-300 ${visitMode === 'DONATION' ? 'text-white' : 'text-slate-500'}`}>
            <i className="fas fa-hand-holding-heart text-[10px]"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">Don</span>
          </button>
          <button onClick={() => setVisitMode('ABSENT')} className={`flex-1 z-10 flex items-center justify-center gap-1.5 transition-all duration-300 ${visitMode === 'ABSENT' ? 'text-white' : 'text-slate-500'}`}>
            <i className="fas fa-clock text-[10px]"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">Absent</span>
          </button>
          <button onClick={() => setVisitMode('REFUSED')} className={`flex-1 z-10 flex items-center justify-center gap-1.5 transition-all duration-300 ${visitMode === 'REFUSED' ? 'text-white' : 'text-slate-500'}`}>
            <i className="fas fa-times text-[10px]"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">Refusé</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
          {visitMode === 'DONATION' ? (
            <div className="space-y-8 animate-fade-in">
              <div>
                <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3 italic">Montant libre</label>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[10, 20, 50].map((val) => (
                    <button
                      key={val}
                      onClick={() => handleQuickAmount(val)}
                      className={`py-4 text-xl font-black rounded-2xl border-2 transition-all duration-200 ${amount === val ? 'border-fire-orange bg-fire-orange text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]' : 'border-slate-800 bg-slate-800/50 text-slate-400'}`}
                    >
                      {val}€
                    </button>
                  ))}
                  <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="bg-slate-800/50 border-2 border-slate-800 rounded-2xl text-center text-xl font-black text-white focus:outline-none focus:border-fire-orange" placeholder="..." />
                </div>
              </div>

              <div className="space-y-4">
                 <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 italic">Nom du donateur (Optionnel)</label>
                 <input type="text" placeholder="Nom ou Anonyme" value={donatorName} onChange={(e) => setDonatorName(e.target.value)} className="w-full bg-slate-800/50 border border-slate-800 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-fire-orange transition-all shadow-inner" />
              </div>

              <div className="space-y-4">
                <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 italic">Mode de reçu</label>
                <div className="bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700 flex h-20 items-center relative overflow-hidden shadow-inner">
                  <div className="absolute h-[calc(100%-12px)] w-[31%] bg-fire-orange rounded-xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-[0_0_15px_rgba(249,115,22,0.4)]" style={{ transform: `translateX(${receiptMethod === 'EMAIL' ? '0%' : receiptMethod === 'SMS' ? '112%' : '224%'})` }}></div>
                  <button onClick={() => setReceiptMethod('EMAIL')} className={`flex-1 z-10 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 ${receiptMethod === 'EMAIL' ? 'text-white scale-110' : 'text-slate-500'}`}>
                    <i className={`fas ${receiptMethod === 'EMAIL' ? 'fa-envelope-open-text' : 'fa-envelope'} text-xl`}></i>
                    <span className="text-[9px] font-black uppercase tracking-widest">Email</span>
                  </button>
                  <button onClick={() => setReceiptMethod('SMS')} className={`flex-1 z-10 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 ${receiptMethod === 'SMS' ? 'text-white scale-110' : 'text-slate-500'}`}>
                    <i className={`fas ${receiptMethod === 'SMS' ? 'fa-comment-dots' : 'fa-mobile-alt'} text-xl`}></i>
                    <span className="text-[9px] font-black uppercase tracking-widest">SMS</span>
                  </button>
                  <button onClick={() => setReceiptMethod('PAPER')} className={`flex-1 z-10 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 ${receiptMethod === 'PAPER' ? 'text-white scale-110' : 'text-slate-500'}`}>
                    <i className={`fas ${receiptMethod === 'PAPER' ? 'fa-print' : 'fa-file-invoice'} text-xl`}></i>
                    <span className="text-[9px] font-black uppercase tracking-widest">Papier</span>
                  </button>
                </div>

                <div className="bg-slate-800/30 p-4 rounded-3xl border border-slate-800/50 min-h-[84px] flex flex-col justify-center">
                  {receiptMethod === 'EMAIL' && (
                    <div className="animate-fade-in">
                      <input type="email" placeholder="Email du donateur" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 px-6 text-white placeholder-slate-700 focus:outline-none focus:border-fire-orange transition-colors" />
                    </div>
                  )}
                  {receiptMethod === 'SMS' && (
                    <div className="animate-fade-in">
                      <input type="tel" placeholder="Numéro de mobile" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 px-6 text-white placeholder-slate-700 focus:outline-none focus:border-fire-orange transition-colors" />
                    </div>
                  )}
                  {receiptMethod === 'PAPER' && (
                    <div className="flex flex-col items-center animate-fade-in py-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mb-2 animate-pulse"></div>
                      <p className="text-center text-slate-500 text-[10px] font-black uppercase tracking-widest italic">Remise papier (Validation immédiate)</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3 italic">Règlement</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.values(PaymentMethod).map((pm) => (
                    <button key={pm} onClick={() => setMethod(pm)} className={`py-4 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all border-2 ${method === pm ? 'bg-blue-600 border-blue-500 text-white shadow-lg scale-[1.02]' : 'bg-slate-800/50 border-slate-800 text-slate-400'}`}>
                      <i className={`fas ${pm === PaymentMethod.CASH ? 'fa-coins' : pm === PaymentMethod.CB ? 'fa-credit-card' : pm === PaymentMethod.CHECK ? 'fa-money-check' : 'fa-mobile-screen'}`}></i>
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleAction}
                  disabled={!isFormValid}
                  className={`w-full text-white text-lg font-black italic uppercase py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all ${isFormValid ? 'bg-green-600 active:scale-95 shadow-green-900/30' : 'bg-slate-800 text-slate-600 opacity-50 cursor-not-allowed'}`}
                >
                  <i className={`fas ${receiptMethod === 'PAPER' ? 'fa-check-double' : 'fa-eye'}`}></i>
                  {receiptMethod === 'PAPER' ? 'VALIDER LE DON' : 'VÉRIFIER LE REÇU IA'}
                </button>
              </div>
            </div>
          ) : visitMode === 'ABSENT' ? (
            <div className="flex flex-col items-center justify-center h-full py-20 animate-fade-in">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center text-amber-500 text-4xl mb-6 border-2 border-amber-500/30 border-dashed">
                <i className="fas fa-clock"></i>
              </div>
              <h3 className="text-white text-xl font-black uppercase italic tracking-tighter mb-4 text-center">Signalement d'absence</h3>
              <p className="text-slate-500 text-center text-xs font-bold leading-relaxed px-10 mb-10">Marquer cette adresse comme absente pour la retrouver plus tard.</p>
              <button onClick={() => handleMarkStatus(VisitStatus.ABSENT)} className="w-full bg-amber-600 text-white text-lg font-black italic uppercase py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-amber-900/20">
                <i className="fas fa-door-closed"></i>
                CONFIRMER L'ABSENCE
              </button>
              <button onClick={onClose} className="mt-4 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">Annuler</button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-20 animate-fade-in">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center text-red-500 text-4xl mb-6 border-2 border-red-500/30 border-dashed">
                <i className="fas fa-times-circle"></i>
              </div>
              <h3 className="text-white text-xl font-black uppercase italic tracking-tighter mb-4 text-center">Refus de visite</h3>
              <p className="text-slate-500 text-center text-xs font-bold leading-relaxed px-10 mb-10">L'occupant refuse le calendrier ou ne souhaite pas participer.</p>
              <button onClick={() => handleMarkStatus(VisitStatus.REFUSED)} className="w-full bg-red-600 text-white text-lg font-black italic uppercase py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-red-900/20">
                <i className="fas fa-ban"></i>
                CONFIRMER LE REFUS
              </button>
              <button onClick={onClose} className="mt-4 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">Annuler</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SaleModal;