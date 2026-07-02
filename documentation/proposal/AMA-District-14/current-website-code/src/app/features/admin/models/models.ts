export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  middle_initial?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  cell_phone: string;
  home_phone: string;
  email: string;
  birthdate: string;
  parent_id?: string;
  disciplines: string[];
  emergency_contact_name: string;
  emergency_contact_phone: string;
  ama_number: string;
  profile_picture: string | null;
  member_type: string;
  membership_option: string | null;
  d14_number: string | null;
  last_modified: string | null;
  signature: string | null;
  date_signed: string | null;
  role: string | null;
  card_status: boolean | null;
  organization_id?: number;
}

export interface MembershipNote {
  id: number;
  membership_id?: string;
  admin_id?: string;
  note_content: string;
  last_modified: string;
  on_card: boolean;
}

export interface Organization {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  email: string;
  phone: string;
  ama_number: string | null;
  website: string | null;
  primary_contact_id: string | null;
  president_name: string | null;
  president_email: string | null;
  president_phone: string | null;
  president_d14: string | null;
  president_address: string | null;
  president_city: string | null;
  president_state: string | null;
  president_zip: string | null;
  president_country: string | null;
  referee_name: string | null;
  referee_email: string | null;
  referee_phone: string | null;
  referee_d14: string | null;
  referee_address: string | null;
  referee_city: string | null;
  referee_state: string | null;
  referee_zip: string | null;
  referee_country: string | null;
}
