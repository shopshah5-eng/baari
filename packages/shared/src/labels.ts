export type OrgMode = 'clinic' | 'lab' | 'salon' | 'spa' | 'other';

export interface LabelSet {
  modeName: string;
  provider: string;
  providers: string;
  customer: string;
  customers: string;
  unit: string;
  units: string;
  room: string;
  rooms: string;
  money: string;
  actionCallNext: string;
  actionAddWalkin: string;
  servingNow: string;
  waitingTitle: string;
  emptyQueuePrompt: string;
}

export const LABELS: Record<OrgMode, LabelSet> = {
  clinic: {
    modeName: 'Clinic',
    provider: 'Doctor',
    providers: 'Doctors',
    customer: 'Patient',
    customers: 'Patients',
    unit: 'Token',
    units: 'Tokens',
    room: 'Cabin',
    rooms: 'Cabins',
    money: 'Consultation fee',
    actionCallNext: 'Call Next Patient',
    actionAddWalkin: 'Add Walk-in Patient',
    servingNow: 'Now Consulting',
    waitingTitle: 'Waiting in Clinic',
    emptyQueuePrompt: 'No patients waiting in queue'
  },
  lab: {
    modeName: 'Diagnostic Lab',
    provider: 'Phlebotomist',
    providers: 'Phlebotomists',
    customer: 'Patient',
    customers: 'Patients',
    unit: 'Booking',
    units: 'Bookings',
    room: 'Collection Point',
    rooms: 'Collection Points',
    money: 'Test price',
    actionCallNext: 'Call Next Sample',
    actionAddWalkin: 'Add Walk-in Test',
    servingNow: 'Collecting Sample',
    waitingTitle: 'Awaiting Collection',
    emptyQueuePrompt: 'No samples waiting in queue'
  },
  salon: {
    modeName: 'Salon',
    provider: 'Stylist',
    providers: 'Stylists',
    customer: 'Client',
    customers: 'Clients',
    unit: 'Slot',
    units: 'Slots',
    room: 'Chair',
    rooms: 'Chairs',
    money: 'Service price',
    actionCallNext: 'Call Next Client',
    actionAddWalkin: 'Add Walk-in Client',
    servingNow: 'Now Styling',
    waitingTitle: 'Waiting for Stylist',
    emptyQueuePrompt: 'No clients waiting in queue'
  },
  spa: {
    modeName: 'Spa & Wellness',
    provider: 'Therapist',
    providers: 'Therapists',
    customer: 'Client',
    customers: 'Clients',
    unit: 'Appointment',
    units: 'Appointments',
    room: 'Treatment Room',
    rooms: 'Treatment Rooms',
    money: 'Session fee',
    actionCallNext: 'Call Next Client',
    actionAddWalkin: 'Add Walk-in Client',
    servingNow: 'In Session',
    waitingTitle: 'Waiting in Lounge',
    emptyQueuePrompt: 'No clients waiting in queue'
  },
  other: {
    modeName: 'Business',
    provider: 'Specialist',
    providers: 'Specialists',
    customer: 'Customer',
    customers: 'Customers',
    unit: 'Token',
    units: 'Tokens',
    room: 'Counter',
    rooms: 'Counters',
    money: 'Service charge',
    actionCallNext: 'Call Next',
    actionAddWalkin: 'Add Walk-in',
    servingNow: 'Now Serving',
    waitingTitle: 'Waiting in Line',
    emptyQueuePrompt: 'No customers waiting in line'
  }
};

export function getLabels(mode: string | undefined | null): LabelSet {
  if (!mode || !(mode in LABELS)) return LABELS.clinic;
  return LABELS[mode as OrgMode];
}

