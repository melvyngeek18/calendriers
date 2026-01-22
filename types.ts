export enum VisitStatus {
  TODO = 'TODO',
  DONE = 'DONE',
  ABSENT = 'ABSENT',
  REFUSED = 'REFUSED'
}

export enum PaymentMethod {
  CASH = 'Espèces',
  CHECK = 'Chèque',
  CB = 'Carte Bancaire',
  LYDIA = 'Lydia'
}

export enum UserRole {
  PORTEUR = 'Porteur',
  RESPONSABLE = 'Responsable',
  ADMIN = 'Administrateur'
}

export type Permission = 
  | 'VIEW_MAP' 
  | 'VIEW_LIST' 
  | 'RECORD_SALE' 
  | 'VIEW_STATS_PERSONAL' 
  | 'VIEW_STATS_SECTOR' 
  | 'VIEW_STATS_GLOBAL' 
  | 'MANAGE_SECTORS' 
  | 'MANAGE_USERS'
  | 'MANAGE_SETTINGS';

export type ReceiptMethod = 'EMAIL' | 'SMS' | 'PAPER';

export interface User {
  id: string;
  rescueCenter: string;
  lastName: string;
  firstName: string;
  role: UserRole;
  rescueCenterLogo?: string;
  sectorId?: string; // Secteur assigné pour Responsable/Porteur
}

export interface Sector {
  id: string;
  name: string;
  streets: string[];
  responsableId?: string;
  porteurIds: string[];
}

export interface AddressPoint {
  id: string;
  lat: number;
  lng: number;
  streetNumber: string;
  streetName: string;
  status: VisitStatus;
  lastVisit?: string; // ISO Date
}

export interface Sale {
  id: string;
  addressId: string;
  userId: string; // Lien avec le porteur qui a fait la vente
  amount: number;
  paymentMethod: PaymentMethod;
  timestamp: string;
  receiptSent: boolean;
  receiptMethod: ReceiptMethod;
  donatorName?: string;
  donatorEmail?: string;
  donatorPhone?: string;
  synced?: boolean; // Pour le suivi offline
}

export interface DailyStat {
  date: string;
  totalAmount: number;
  calendarsDistributed: number;
}