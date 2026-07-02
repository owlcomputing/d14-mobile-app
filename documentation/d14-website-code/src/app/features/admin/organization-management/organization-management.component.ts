import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastrService } from 'ngx-toastr';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { environment } from '../../../../environments/environment';

interface Organization {
  id: number;
  name: string;
  address: string | null;
  address_line2?: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  ama_number: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  primary_contact_d14: string | null;
  primary_contact_address: string | null;
  primary_contact_city: string | null;
  primary_contact_state: string | null;
  primary_contact_zip: string | null;
  primary_contact_country: string | null;
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
  created_at?: string;
  updated_at?: string;
  organization_user_id: string | null;
}

interface OrganizationWithDetails extends Organization {
  membership_status?: string;
  expiration_date?: string;
}

@Component({
  selector: 'app-organization-management',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, MatTooltipModule],
  templateUrl: './organization-management.component.html',
})
export class OrganizationManagementComponent implements OnInit {
  organizations: OrganizationWithDetails[] = [];
  selectedOrg: OrganizationWithDetails | null = null;
  editedOrg: Organization | null = null;
  orgToDelete: Organization | null = null;
  isEditing = false;
  searchString = '';
  orgToRenew: OrganizationWithDetails | null = null;
  newOrg: Partial<Organization> = {
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    phone: '',
    email: '',
    website: null,
    ama_number: null,
    organization_user_id: null,
    primary_contact_name: null,
    primary_contact_email: null,
    primary_contact_phone: null,
    primary_contact_d14: null,
    primary_contact_address: null,
    primary_contact_city: null,
    primary_contact_state: null,
    primary_contact_zip: null,
    primary_contact_country: null,
    president_name: null,
    president_email: null,
    president_phone: null,
    president_d14: null,
    president_address: null,
    president_city: null,
    president_state: null,
    president_zip: null,
    president_country: null,
    referee_name: null,
    referee_email: null,
    referee_phone: null,
    referee_d14: null,
    referee_address: null,
    referee_city: null,
    referee_state: null,
    referee_zip: null,
    referee_country: null,
  };

  constructor(
    private supabaseService: SupabaseService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.fetchOrganizations();
  }

  async fetchOrganizations() {
    try {
      // First get all organizations
      const { data: orgData, error: orgError } =
        await this.supabaseService.supabase.from('organizations').select('*');

      if (orgError) throw orgError;

      // Get all memberships for organizations (virtual club memberships)
      const { data: membershipData, error: membershipError } =
        await this.supabaseService.supabase
          .from('memberships')
          .select('*')
          .in(
            'profile_id',
            orgData
              .map((org) => org.organization_user_id)
              .filter((id): id is string => id !== null)
          );

      if (membershipError) throw membershipError;

      const currentDate = new Date();
      this.organizations = orgData.map((org) => {
        const orgMembership = membershipData.find(
          (m) => m.profile_id === org.organization_user_id
        );
        const isActive = orgMembership
          ? new Date(orgMembership.expiration) > currentDate
          : false;

        return {
          ...org,
          membership_status: isActive ? 'active' : 'expired',
          expiration_date: orgMembership?.expiration || 'N/A',
        };
      });
    } catch (error) {
      console.error('Error fetching organizations:', error);
      this.toastr.error('Error fetching organizations');
    }
  }

  openEditModal(org: OrganizationWithDetails) {
    this.selectedOrg = org;
    this.editedOrg = { ...org };
    this.isEditing = true;
    (document.getElementById('org_modal') as HTMLDialogElement).show();
  }

  closeModal() {
    this.selectedOrg = null;
    this.editedOrg = null;
    this.isEditing = false;
    (document.getElementById('org_modal') as HTMLDialogElement).close();
  }

  async saveChanges() {
    if (!this.editedOrg) return;

    try {
      const { error } = await this.supabaseService.supabase
        .from('organizations')
        .update({
          name: this.editedOrg.name,
          address: this.editedOrg.address,
          city: this.editedOrg.city,
          state: this.editedOrg.state,
          zip: this.editedOrg.zip,
          country: this.editedOrg.country,
          phone: this.editedOrg.phone,
          email: this.editedOrg.email,
          website: this.editedOrg.website,
          ama_number: this.editedOrg.ama_number,
          organization_user_id: this.editedOrg.organization_user_id,
          primary_contact_name: this.editedOrg.primary_contact_name,
          primary_contact_email: this.editedOrg.primary_contact_email,
          primary_contact_phone: this.editedOrg.primary_contact_phone,
          primary_contact_d14: this.editedOrg.primary_contact_d14,
          primary_contact_address: this.editedOrg.primary_contact_address,
          primary_contact_city: this.editedOrg.primary_contact_city,
          primary_contact_state: this.editedOrg.primary_contact_state,
          primary_contact_zip: this.editedOrg.primary_contact_zip,
          primary_contact_country: this.editedOrg.primary_contact_country,
          president_name: this.editedOrg.president_name,
          president_email: this.editedOrg.president_email,
          president_phone: this.editedOrg.president_phone,
          president_d14: this.editedOrg.president_d14,
          president_address: this.editedOrg.president_address,
          president_city: this.editedOrg.president_city,
          president_state: this.editedOrg.president_state,
          president_zip: this.editedOrg.president_zip,
          president_country: this.editedOrg.president_country,
          referee_name: this.editedOrg.referee_name,
          referee_email: this.editedOrg.referee_email,
          referee_phone: this.editedOrg.referee_phone,
          referee_d14: this.editedOrg.referee_d14,
          referee_address: this.editedOrg.referee_address,
          referee_city: this.editedOrg.referee_city,
          referee_state: this.editedOrg.referee_state,
          referee_zip: this.editedOrg.referee_zip,
          referee_country: this.editedOrg.referee_country,
        })
        .eq('id', this.editedOrg.id);

      if (error) throw error;

      // Update the virtual charter member profile if it exists
      if (this.editedOrg.organization_user_id) {
        const { error: updateError } = await this.supabaseService.supabase
          .from('profiles')
          .update({
            first_name: `${this.editedOrg.name}`,
            last_name: 'MEMBERSHIP',
            email: this.editedOrg.email,
            cell_phone: this.editedOrg.phone,
            address_line1: this.editedOrg.address,
            city: this.editedOrg.city,
            state: this.editedOrg.state,
            zip: this.editedOrg.zip,
            country: this.editedOrg.country,
            ama_number: this.editedOrg.ama_number,
          })
          .eq('id', this.editedOrg.organization_user_id);

        if (updateError) throw updateError;
      }

      this.toastr.success('Organization updated successfully');
      this.fetchOrganizations();
      this.closeModal();
    } catch (error) {
      console.error('Error updating organization:', error);
      this.toastr.error('Error updating organization');
    }
  }

  filterOrganizations(): OrganizationWithDetails[] {
    if (!this.searchString) return this.organizations;

    const searchLower = this.searchString.toLowerCase();
    return this.organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(searchLower) ||
        org.email?.toLowerCase().includes(searchLower) ||
        org.primary_contact_name?.toLowerCase().includes(searchLower)
    );
  }

  openAddOrgModal() {
    this.newOrg = {
      name: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      phone: '',
      email: '',
      website: null,
      ama_number: null,
      organization_user_id: null,
      primary_contact_name: null,
      primary_contact_email: null,
      primary_contact_phone: null,
      primary_contact_d14: null,
      primary_contact_address: null,
      primary_contact_city: null,
      primary_contact_state: null,
      primary_contact_zip: null,
      primary_contact_country: null,
      president_name: null,
      president_email: null,
      president_phone: null,
      president_d14: null,
      president_address: null,
      president_city: null,
      president_state: null,
      president_zip: null,
      president_country: null,
      referee_name: null,
      referee_email: null,
      referee_phone: null,
      referee_d14: null,
      referee_address: null,
      referee_city: null,
      referee_state: null,
      referee_zip: null,
      referee_country: null,
    };
    (document.getElementById('add_org_modal') as HTMLDialogElement).show();
  }

  closeAddOrgModal() {
    this.newOrg = {
      name: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      phone: '',
      email: '',
      website: null,
      ama_number: null,
      organization_user_id: null,
      primary_contact_name: null,
      primary_contact_email: null,
      primary_contact_phone: null,
      primary_contact_d14: null,
      primary_contact_address: null,
      primary_contact_city: null,
      primary_contact_state: null,
      primary_contact_zip: null,
      primary_contact_country: null,
      president_name: null,
      president_email: null,
      president_phone: null,
      president_d14: null,
      president_address: null,
      president_city: null,
      president_state: null,
      president_zip: null,
      president_country: null,
      referee_name: null,
      referee_email: null,
      referee_phone: null,
      referee_d14: null,
      referee_address: null,
      referee_city: null,
      referee_state: null,
      referee_zip: null,
      referee_country: null,
    };
    (document.getElementById('add_org_modal') as HTMLDialogElement).close();
  }

  async addOrganization() {
    if (!this.newOrg.name) {
      this.toastr.error('Please enter an organization name');
      return;
    }

    try {
      // First create the virtual club membership using createUser endpoint
      const virtualMemberData = {
        first_name: `${this.newOrg.name} Charter Membership`,
        last_name: '',
        email: this.newOrg.email || '',
        cell_phone: this.newOrg.phone || '',
        address_line1: this.newOrg.address || '',
        city: this.newOrg.city || '',
        state: this.newOrg.state || '',
        zip: this.newOrg.zip || '',
        country: this.newOrg.country || '',
        member_type: 'Charter',
        ama_number: this.newOrg.ama_number || '',
        disciplines: [],
        password: 'password', // Temporary password
      };

      const response = await fetch(
        `${environment.supabaseUrl}/functions/v1/createUser`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(virtualMemberData),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.error || 'Error creating virtual club membership'
        );
      }

      const result = await response.json();
      const virtualMemberId = result.user.id;

      // Create a complete organization object
      const newOrgData: Omit<Organization, 'id'> = {
        name: this.newOrg.name || '',
        address: this.newOrg.address || null,
        city: this.newOrg.city || null,
        state: this.newOrg.state || null,
        zip: this.newOrg.zip || null,
        country: this.newOrg.country || null,
        phone: this.newOrg.phone || null,
        email: this.newOrg.email || null,
        website: this.newOrg.website || null,
        ama_number: this.newOrg.ama_number || null,
        organization_user_id: virtualMemberId,
        primary_contact_name: this.newOrg.primary_contact_name || null,
        primary_contact_email: this.newOrg.primary_contact_email || null,
        primary_contact_phone: this.newOrg.primary_contact_phone || null,
        primary_contact_d14: this.newOrg.primary_contact_d14 || null,
        primary_contact_address: this.newOrg.primary_contact_address || null,
        primary_contact_city: this.newOrg.primary_contact_city || null,
        primary_contact_state: this.newOrg.primary_contact_state || null,
        primary_contact_zip: this.newOrg.primary_contact_zip || null,
        primary_contact_country: this.newOrg.primary_contact_country || null,
        president_name: this.newOrg.president_name || null,
        president_email: this.newOrg.president_email || null,
        president_phone: this.newOrg.president_phone || null,
        president_d14: this.newOrg.president_d14 || null,
        president_address: this.newOrg.president_address || null,
        president_city: this.newOrg.president_city || null,
        president_state: this.newOrg.president_state || null,
        president_zip: this.newOrg.president_zip || null,
        president_country: this.newOrg.president_country || null,
        referee_name: this.newOrg.referee_name || null,
        referee_email: this.newOrg.referee_email || null,
        referee_phone: this.newOrg.referee_phone || null,
        referee_d14: this.newOrg.referee_d14 || null,
        referee_address: this.newOrg.referee_address || null,
        referee_city: this.newOrg.referee_city || null,
        referee_state: this.newOrg.referee_state || null,
        referee_zip: this.newOrg.referee_zip || null,
        referee_country: this.newOrg.referee_country || null,
      };

      // Then create the organization with the virtual member ID
      const { error: orgError } = await this.supabaseService.supabase
        .from('organizations')
        .insert(newOrgData);

      if (orgError) throw orgError;

      this.toastr.success('Organization added successfully');
      this.fetchOrganizations();
      this.closeAddOrgModal();
    } catch (error) {
      console.error('Error adding organization:', error);
      this.toastr.error('Error adding organization');
    }
  }

  async deleteOrganization(org: Organization) {
    this.orgToDelete = org;
    (document.getElementById('delete_org_modal') as HTMLDialogElement).show();
  }

  closeDeleteModal() {
    this.orgToDelete = null;
    (document.getElementById('delete_org_modal') as HTMLDialogElement).close();
  }

  async confirmDelete() {
    if (!this.orgToDelete) return;

    // remove the virtual charter member profile from the database

    try {
      // First delete the organization
      const { error: orgError } = await this.supabaseService.supabase
        .from('organizations')
        .delete()
        .eq('id', this.orgToDelete.id);

      if (orgError) throw orgError;
      // Then delete the virtual charter member profile if it exists
      if (this.orgToDelete.organization_user_id) {
        const response = await fetch(
          `${environment.supabaseUrl}/functions/v1/deleteUser`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              profile_id: this.orgToDelete.organization_user_id,
            }),
          }
        );

        if (!response.ok) {
          const result = await response.json();
          throw new Error(
            result.error || 'Error deleting virtual club membership'
          );
        }
      }

      this.toastr.success('Organization deleted successfully');
      this.fetchOrganizations();
      this.closeDeleteModal();
    } catch (error) {
      console.error('Error deleting organization:', error);
      this.toastr.error('Error deleting organization');
      this.closeDeleteModal();
    }
  }

  openRenewModal(org: OrganizationWithDetails) {
    this.orgToRenew = org;
    (document.getElementById('renew_org_modal') as HTMLDialogElement).show();
  }

  closeRenewModal() {
    this.orgToRenew = null;
    (document.getElementById('renew_org_modal') as HTMLDialogElement).close();
  }

  async renewMembership() {
    if (!this.orgToRenew?.organization_user_id) {
      this.toastr.error(
        'No virtual club membership found for this organization'
      );
      return;
    }

    try {
      // Get membership info
      const { data: membershipData, error: membershipError } =
        await this.supabaseService.supabase
          .from('memberships')
          .select('*')
          .eq('profile_id', this.orgToRenew.organization_user_id);

      if (membershipError) {
        console.error('Error fetching membership:', membershipError.message);
        this.toastr.error('Error fetching membership');
        return;
      }

      if (!membershipData || membershipData.length === 0) {
        this.toastr.error('No membership found for organization');
        return;
      }

      const membership = membershipData[0];

      // Calculate new expiration date
      const expirationDate = new Date(membership.expiration);
      const today = new Date();
      if (expirationDate < today) {
        expirationDate.setFullYear(today.getFullYear() + 1);
      } else {
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      }

      // Update membership
      const { error: updateError } = await this.supabaseService.supabase
        .from('memberships')
        .update({
          expiration: expirationDate.toISOString(),
          last_modified: new Date().toISOString(),
        })
        .eq('profile_id', this.orgToRenew.organization_user_id);

      if (updateError) {
        console.error('Error renewing membership:', updateError.message);
        this.toastr.error('Error renewing membership');
        return;
      }

      // Create receipt
      const { error: receiptError } = await this.supabaseService.supabase
        .from('membership_receipts')
        .insert({
          profile_id: this.orgToRenew.organization_user_id,
          amount_paid: 25, // Charter membership fee
          date_created: new Date().toISOString(),
          payment_method: 'cash/check',
        });

      if (receiptError) {
        console.error('Error creating receipt:', receiptError.message);
        this.toastr.error('Error creating receipt');
        return;
      }

      this.toastr.success('Organization membership renewed successfully');
      this.fetchOrganizations();
      this.closeRenewModal();
    } catch (error) {
      console.error('Error renewing organization membership:', error);
      this.toastr.error('Error renewing organization membership');
    }
  }

  async updateExpirationDate(newDate: string) {
    if (!this.selectedOrg?.organization_user_id) return;

    try {
      const { error } = await this.supabaseService.supabase
        .from('memberships')
        .update({
          expiration: new Date(newDate).toISOString(),
          last_modified: new Date().toISOString(),
        })
        .eq('profile_id', this.selectedOrg.organization_user_id);

      if (error) throw error;

      this.toastr.success('Expiration date updated successfully');
      this.fetchOrganizations();
    } catch (error) {
      console.error('Error updating expiration date:', error);
      this.toastr.error('Error updating expiration date');
    }
  }
}
