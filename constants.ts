import { AddressPoint, VisitStatus } from "./types";

// Mock Data for the simulation
export const MOCK_ADDRESSES: AddressPoint[] = [
  { id: '1', lat: 48.8566, lng: 2.3522, streetNumber: '12', streetName: 'Rue de Rivoli', status: VisitStatus.TODO },
  { id: '2', lat: 48.8570, lng: 2.3530, streetNumber: '14', streetName: 'Rue de Rivoli', status: VisitStatus.DONE, lastVisit: '2023-11-01T10:00:00Z' },
  { id: '3', lat: 48.8560, lng: 2.3510, streetNumber: '8', streetName: 'Rue de la Pompe', status: VisitStatus.ABSENT, lastVisit: '2023-11-02T18:30:00Z' },
  { id: '4', lat: 48.8580, lng: 2.3540, streetNumber: '22', streetName: 'Av. Victoria', status: VisitStatus.TODO },
  { id: '5', lat: 48.8550, lng: 2.3500, streetNumber: '1', streetName: 'Bd du Palais', status: VisitStatus.REFUSED },
];

export const STATUS_COLORS = {
  [VisitStatus.TODO]: '#94a3b8', // slate-400
  [VisitStatus.DONE]: '#22c55e', // green-500
  [VisitStatus.ABSENT]: '#f59e0b', // amber-500
  [VisitStatus.REFUSED]: '#ef4444', // red-500
};

export const STATUS_LABELS = {
  [VisitStatus.TODO]: 'À faire',
  [VisitStatus.DONE]: 'Fait',
  [VisitStatus.ABSENT]: 'Absent',
  [VisitStatus.REFUSED]: 'Refusé',
};