export interface Submission {
  submission_id: string;
  submission_date: string;
  vessel_number?: string;
  catch_number?: string;
  alert_number?: string;
  validation_status: string;
  validated_at: string;
  alert_flag?: string;
  alert_flags?: string[];
}

type ValidationStatus = 
  | 'validation_status_approved'
  | 'validation_status_not_approved'
  | 'validation_status_on_hold'
  | 'default';

type StyleConfig = {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
};

export const STATUS_STYLES: Record<ValidationStatus, StyleConfig> = {
  validation_status_approved: {
    backgroundColor: 'rgba(87, 167, 115, 0.15)',  // #57A773
    textColor: '#57A773',
    borderColor: 'rgba(87, 167, 115, 0.3)',
  },
  validation_status_not_approved: {
    backgroundColor: 'rgba(211, 78, 36, 0.15)',   // #D34E24
    textColor: '#D34E24',
    borderColor: 'rgba(211, 78, 36, 0.3)',
  },
  validation_status_on_hold: {
    backgroundColor: 'rgba(137, 144, 159, 0.15)', // #89909F
    textColor: '#89909F',
    borderColor: 'rgba(137, 144, 159, 0.3)',
  },
  default: {
    backgroundColor: 'rgba(137, 144, 159, 0.15)', // Same as on_hold
    textColor: '#89909F',
    borderColor: 'rgba(137, 144, 159, 0.3)',
  },
};

export const ALERT_FLAG_DESCRIPTIONS = {
  '5': 'Bucket weight exceeds maximum (50kg)',
  '6': 'Number of buckets exceeds maximum (300)',
  '7': 'Number of individuals exceeds maximum (100)',
  '8': 'A catch was reported, but no details were provided about the species, quantity, or weight',
  '9': 'A species was specified, but no information was recorded about the number of fish, their size, or their weight' 
};

export const VALIDATION_STATUS_OPTIONS = [
  'validation_status_approved',
  'validation_status_not_approved',
  'validation_status_on_hold'
]; 