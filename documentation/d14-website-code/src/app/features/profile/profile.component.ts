import {
  Component,
  OnInit,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Router } from '@angular/router';
import { PhoneFormatPipe } from './phone-format.pipe';
import { Profile } from '../admin/models/models';
import { ToastrService } from 'ngx-toastr';
import { MatTooltip } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { MembershipCardService } from '../../shared/services/membership-card.service';

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
  organization_user_id?: string | null;
}

interface MembershipNote {
  id: number;
  membership_id?: string;
  admin_id?: string;
  note_content: string;
  last_modified: string;
  on_card: boolean;
}
@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  imports: [CommonModule, FormsModule, PhoneFormatPipe, MatTooltip],
  standalone: true,
})
export class ProfileComponent implements OnInit {
  profileLoading: boolean = true;
  onCardNotes: MembershipNote[] = []; // Array to store notes marked as on_card
  activeTooltip: MatTooltip | null = null;

  profile: profileMembership | null = null;
  organization: Organization | null = null;
  oldProfile: Profile | null = null;
  children: profileMembership[] = [];
  ChildInfoToShow: Profile | null = null;
  isModalOpen: boolean = false;
  logoDataUrl: string | null = null;
  showConvertModal: boolean = false;
  convertedMember: any = {};
  divisions: any[] = [];
  newPassword: string = '';
  confirmPassword: string = '';
  newEmail: string = '';
  membershipCardUser: profileMembership | null = null;

  @ViewChild('membershipCard') membershipCard!: ElementRef;
  showRenewalModal = false;
  selectedForRenewal: profileMembership[] | null = null;

  addFamilyMember: boolean = false;
  newFamilyMember: Profile | null = null;
  isAddingFamilyMember = false;

  fullMembershipModal: boolean = false;
  amaNumber: string = '';
  fullMembershipDisciplines: string[] = [];

  isEditing: boolean = false;

  constructor(
    private authService: AuthService,
    private supabase: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    private membershipCardService: MembershipCardService
  ) {}

  async ngOnInit() {
    await this.loadProfile();
    await this.loadLogoAsDataUrl();
    await this.fetchDivisions();
  }

  private async loadProfile() {
    localStorage.removeItem('user_profile');
    const profileSubscription = this.authService.profile$.subscribe({
      next: async (profile) => {
        if (profile) {
          const { data, error } = await this.supabase.supabase
            .from('profiles')
            .select('*')
            .eq('id', profile.id)
            .single();

          if (error) {
            console.error('Error loading profile:', error.message);
            return;
          }

          if (data) {
            const updatedProfile = data as Profile;
            this.profile = {
              profile: updatedProfile,
              membership:
                updatedProfile.member_type === 'Family'
                  ? null
                  : await this.getMembershipInfo(updatedProfile.id),
            };
          }

          if (this.profile) {
            await this.getChildren(); // Fetch children if profile is valid
          }

          // Set loading to false only after profile and children have loaded
          this.profileLoading = false;

          // Unsubscribe after the first valid profile is received
          profileSubscription.unsubscribe();
        }
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.profileLoading = false; // Stop loading if there's an error
        profileSubscription.unsubscribe(); // Unsubscribe in case of error
      },
      complete: () => {
        if (!this.profile) {
          console.error('Profile not found.');
          this.profileLoading = false; // If profile is still null, log and stop loading
        }
      },
    });
  }

  private async fetchOnCardNotes() {
    try {
      if (!this.profile || !this.profile.profile.id) {
        console.error('Profile ID is missing.');
        return;
      }

      const { data, error } = await this.supabase.supabase
        .from('membership_notes')
        .select('id, note_content, last_modified, on_card')
        .eq('membership_id', this.profile.profile.id) // Filter by membership_id
        .eq('on_card', true) // Only fetch notes marked on_card
        .order('last_modified', { ascending: false });

      if (error) {
        console.error('Error fetching on-card notes:', error.message);
        this.toastr.error('Error fetching notes for membership card.');
        return;
      }

      this.onCardNotes = data || [];
      this.cdr.detectChanges(); // Update the view
    } catch (error) {
      console.error('Unexpected error fetching on-card notes:', error);
      this.toastr.error('Unexpected error fetching notes.');
    }
  }

  async loadLogoAsDataUrl() {
    try {
      const response = await fetch('/assets/images/d14_logo.png');
      const blob = await response.blob();
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          this.logoDataUrl = reader.result as string;
          resolve();
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }

  private async getChildren() {
    const parent_id = this.profile?.profile.id;
    if (!parent_id) {
      console.error('Parent ID not found.');
      return;
    }

    const { data, error } = await this.supabase.supabase
      .from('profiles')
      .select('*')
      .eq('parent_id', parent_id);

    if (error) {
      console.error('Error getting children:', error.message);
      return;
    }

    if (data) {
      const profiles = data as Profile[];

      // Now fetch the memberships after we have the profiles
      const memberships = await this.getChildMemberships(profiles);

      this.children = profiles.map((profile, index) => ({
        profile,
        membership: memberships ? memberships[index] : null,
      }));

      if (
        this.profile?.profile.member_type === 'Charter' &&
        this.profile?.profile.organization_id
      ) {
        this.organization = await this.getOrganizationInfo(
          this.profile.profile.organization_id
        );
      }

      this.cdr.detectChanges(); // Ensure changes are reflected in the view
    }
  }

  private async getChildMemberships(profiles: Profile[]) {
    if (!profiles || profiles.length === 0) {
      return null;
    }

    // Fetch memberships for each profile
    return Promise.all(
      profiles.map((child) => this.getMembershipInfo(child.id))
    );
  }

  private async getMembershipInfo(id: string) {
    const { data, error } = await this.supabase.supabase
      .from('memberships')
      .select('*')
      .eq('profile_id', id)
      .single();

    if (error) {
      console.error('Error getting membership:', error.message);
      return null;
    }

    return data as Membership | null;
  }

  private async getOrganizationInfo(id: number) {
    const { data, error } = await this.supabase.supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error getting organization:', error.message);
      return null;
    }

    return data as Organization | null;
  }

  async fetchDivisions() {
    try {
      const { data, error } = await this.supabase.supabase
        .from('divisions')
        .select('name');

      if (error) {
        console.error('Error fetching divisions:', error.message);
      } else if (data) {
        this.divisions = data;
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }

  pushToSignUp() {
    this.router.navigateByUrl('/secure/membership');
  }

  private async deleteUser(userToDelete: Profile) {
    if (!userToDelete) return;
    try {
      const response = await fetch(
        `${environment.supabaseUrl}/functions/v1/deleteUser`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile_id: userToDelete.id,
          }),
        }
      );

      if (response.status === 204 || response.ok) {
      } else {
        const result = await response.json();
        console.error(result.error || 'Error deleting user');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }

  toggleChildInfo(child: Profile) {
    this.ChildInfoToShow = this.ChildInfoToShow === child ? null : child;
    this.cdr.detectChanges();
  }

  convertToSeparateUser(child: Profile) {
    this.convertedMember = child;
    this.convertedMember.emergency_contact_name =
      this.profile?.profile.first_name + ' ' + this.profile?.profile.last_name;
    this.convertedMember.emergency_contact_phone =
      this.profile?.profile.cell_phone;
    this.cdr.detectChanges();
    this.toggleConversionModal();
  }

  toggleConversionModal() {
    const modal = document.getElementById(
      'convert_to_independent_modal'
    ) as HTMLDialogElement;
    if (modal.open) {
      modal.close();
      this.resetConversionForm();
    } else {
      modal.show();
    }
  }

  async completeConversion() {
    if (!this.convertedMember) {
      this.toastr.error('Please reload the page and try again.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.toastr.error('Passwords do not match.');
      return;
    }

    this.convertedMember.email = this.newEmail;
    this.convertedMember.parent_id = null;

    try {
      await this.createUser(
        this.convertedMember,
        this.newPassword,
        this.convertedMember.id
      );
      await this.deleteUser(this.convertedMember);
    } catch (error) {
      console.error('Error during user conversion:', error);
      return;
    }

    this.resetConversionForm();
    this.toggleConversionModal();
    this.cdr.detectChanges();
    this.toastr.success('Member converted successfully.');
  }

  resetConversionForm() {
    this.convertedMember = null;
    this.newPassword = '';
    this.confirmPassword = '';
  }

  private async createUser(
    newUser: Profile,
    password: string,
    existing_member_id: string
  ) {
    const requestData: any = {
      ...newUser,
      password: password,
      existing_member: existing_member_id,
    };
    const response = await fetch(
      `${environment.supabaseUrl}/functions/v1/createUser`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      }
    );

    const result = await response.json();

    if (response.ok) {
    } else {
      console.error('Error creating new user:', result.error);
      return;
    }
  }

  isProfileSelected(profile: profileMembership): boolean {
    return (
      this.selectedForRenewal?.some(
        (p) => p.profile.id === profile.profile.id
      ) || false
    );
  }

  isRenewableProfile(profile: profileMembership | null | undefined): boolean {
    return Boolean(profile?.membership);
  }

  private getRenewableProfiles(): profileMembership[] {
    const renewableProfiles: profileMembership[] = [];

    if (this.profile?.membership) {
      renewableProfiles.push(this.profile);
    }

    renewableProfiles.push(
      ...this.children.filter((child) => this.isRenewableProfile(child))
    );

    return renewableProfiles;
  }

  toggleRenewalList(profile: profileMembership) {
    if (!this.isRenewableProfile(profile)) {
      return;
    }

    // Check if profile is already selected by comparing profile IDs
    const isSelected = this.isProfileSelected(profile);

    if (!isSelected) {
      // Add to selection
      this.selectedForRenewal = this.selectedForRenewal
        ? [...this.selectedForRenewal, profile]
        : [profile];
    } else {
      // Remove from selection
      this.selectedForRenewal =
        this.selectedForRenewal?.filter(
          (p) => p.profile.id !== profile.profile.id
        ) || [];
    }

    this.cdr.detectChanges();
  }

  async renewSelectedMemberships() {
    if (!this.selectedForRenewal || this.selectedForRenewal.length === 0) {
      console.error('No profiles selected for renewal.');
      this.toastr.error('Select at least one active membership to renew.');
      return;
    }

    // FIRST: Clear any existing renewal records for this user family
    const userId = this.profile?.profile.id;
    if (!userId) {
      this.toastr.error('Unable to determine which account is renewing.');
      return;
    }

    const membershipData = this.selectedForRenewal.map((profile) => ({
      id: profile.profile.id,
      parent_id: profile.profile.parent_id || userId,
    }));

    try {
      await this.clearExistingTempMembershipData(userId);
      await this.clearExistingRenewals(userId);

      const { data: insertedRenewals, error: insertError } =
        await this.supabase.supabase
          .from('renewals')
          .insert(membershipData)
          .select('id');

      if (insertError) {
        console.error('Error caching renewal selections:', insertError.message);
        this.toastr.error('Unable to start checkout for the selected renewals.');
        return;
      }

      if (!insertedRenewals || insertedRenewals.length !== membershipData.length) {
        console.error('Renewal selection count mismatch after insert.', {
          expected: membershipData.length,
          actual: insertedRenewals?.length ?? 0,
        });
        this.toastr.error('Unable to verify the selected renewals before checkout.');
        return;
      }

      this.router.navigateByUrl('/secure/checkout');
    } catch (error) {
      console.error('Unexpected error preparing renewals:', error);
      this.toastr.error('Unable to prepare the renewal checkout.');
    }
  }

  async clearExistingRenewals(userId: string) {
    try {
      // We need to determine the family head (parent) ID to clear all renewals for this family
      let parentId = userId;

      // If the current user has a parent_id, they are a child, so use their parent_id
      if (this.profile?.profile.parent_id) {
        parentId = this.profile.profile.parent_id;
      }

      console.log('Clearing renewals for family with parent ID:', parentId);

      // First, let's see what renewals exist before deletion
      const { data: existingRenewals, error: selectError } =
        await this.supabase.supabase
          .from('renewals')
          .select('*')
          .or(`id.eq.${parentId},parent_id.eq.${parentId}`);

      if (selectError) {
        console.error('Error fetching existing renewals:', selectError.message);
        throw selectError;
      }

      console.log('Existing renewals before deletion:', existingRenewals);

      if (existingRenewals && existingRenewals.length > 0) {
        // Clear ALL renewals for this family:
        // 1. Any renewal where id = parentId (the parent's own renewal)
        // 2. Any renewal where parent_id = parentId (any child renewals for this family)
        const { data, error, count } = await this.supabase.supabase
          .from('renewals')
          .delete({ count: 'exact' })
          .or(`id.eq.${parentId},parent_id.eq.${parentId}`);

        if (error) {
          console.error('Error clearing existing renewals:', error.message);
          throw error;
        }

        console.log('Delete operation result:', { data, count });
        console.log(`Successfully deleted ${count} renewal records`);
      } else {
        console.log('No existing renewals found to delete');
      }

      // Verify deletion worked
      const { data: remainingRenewals, error: verifyError } =
        await this.supabase.supabase
          .from('renewals')
          .select('*')
          .or(`id.eq.${parentId},parent_id.eq.${parentId}`);

      if (verifyError) {
        console.error('Error verifying deletion:', verifyError.message);
      } else {
        console.log('Remaining renewals after deletion:', remainingRenewals);
      }
    } catch (error) {
      console.error('Unexpected error clearing renewals:', error);
      throw error;
    }
  }

  async clearExistingTempMembershipData(userId: string) {
    try {
      let parentId = userId;

      if (this.profile?.profile.parent_id) {
        parentId = this.profile.profile.parent_id;
      }

      const { error: userTempError } = await this.supabase.supabase
        .from('temp_membership_form_data')
        .delete()
        .eq('user_id', parentId);

      if (userTempError) {
        console.error(
          'Error clearing existing temp membership data:',
          userTempError.message
        );
        throw userTempError;
      }

      const { error: familyTempError } = await this.supabase.supabase
        .from('temp_membership_form_data')
        .delete()
        .eq('parent_id', parentId);

      if (familyTempError) {
        console.error(
          'Error clearing existing family temp membership data:',
          familyTempError.message
        );
        throw familyTempError;
      }
    } catch (error) {
      console.error('Unexpected error clearing temp membership data:', error);
      throw error;
    }
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/']);
  }

  openMembershipCardModal(user: profileMembership) {
    this.fetchOnCardNotes();
    this.membershipCardUser = user;
    this.isModalOpen = true;
    this.cdr.detectChanges();
  }

  closeMembershipCardModal() {
    this.membershipCardUser = null;
    this.isModalOpen = false;
  }

  printMembershipCard() {
    if (!this.membershipCardUser || !this.logoDataUrl) {
      console.error('Membership card data is missing.');
      return;
    }

    this.membershipCardService.printMembershipCard(
      this.membershipCardUser,
      this.logoDataUrl,
      this.onCardNotes
    );

    this.closeMembershipCardModal();
  }

  async toggleCardPrint() {
    if (!this.profile?.membership) {
      console.error('No membership to indicate card print for');
      return;
    }

    if (this.profile.profile.card_status === null) {
      this.profile.profile.card_status = false;
    }

    const { data, error } = await this.supabase.supabase
      .from('profiles')
      .update({ card_status: !this.profile.profile.card_status })
      .eq('id', this.profile.profile.id);

    if (error) {
      console.error('Error updating card print status:', error.message);
      return;
    }

    this.profile.profile.card_status = !this.profile.profile.card_status;
    this.cdr.detectChanges();
  }

  openRenewalModal() {
    this.selectedForRenewal = this.getRenewableProfiles();
    this.showRenewalModal = true;
    this.cdr.detectChanges();
  }

  closeRenewalModal() {
    this.showRenewalModal = false;
    this.cdr.detectChanges();
  }

  isMembershipExpired(exp_date: string | undefined): boolean {
    if (!exp_date) return true;
    return new Date(exp_date) < new Date();
  }

  toggleEditing() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      if (this.profile) {
        this.oldProfile = this.profile.profile;
      }
    } else if (!this.isEditing) {
      this.oldProfile = null;
    }
    this.cdr.detectChanges();
  }

  async saveProfileChanges() {
    this.toggleEditing();
    const updatedProfile = this.profile?.profile;
    if (!updatedProfile || !updatedProfile.id) {
      console.error('Profile or Profile ID is missing.');
      return;
    }
    updatedProfile.last_modified = new Date().toISOString();
    // update profile in supabase
    const { error } = await this.supabase.supabase
      .from('profiles')
      .update(updatedProfile)
      .eq('id', updatedProfile.id);

    if (error) {
      console.error('Error updating profile:', error.message);
    } else {
    }
    this.cdr.detectChanges();
  }

  toggleDisciplineChange(discipline: string) {
    if (this.profile) {
      const updatedProfile = this.profile.profile;
      if (updatedProfile?.disciplines?.includes(discipline)) {
        updatedProfile.disciplines = updatedProfile.disciplines.filter(
          (d) => d !== discipline
        );
      } else {
        updatedProfile?.disciplines?.push(discipline);
      }
      this.profile.profile = updatedProfile;
    }
    this.cdr.detectChanges();
  }

  openAddFamilyMemberModal() {
    if (this.profile) {
      this.generateNewFamilyMember();
    }
    this.cdr.detectChanges();
    this.addFamilyMember = true;
  }

  closeAddFamilyMemberModal() {
    this.addFamilyMember = false;
    this.newFamilyMember = null;
    this.cdr.detectChanges();
  }

  generateNewFamilyMember() {
    if (this.profile) {
      const parentProfile = this.profile.profile;
      this.newFamilyMember = {
        id: '',
        first_name: '',
        last_name: '',
        middle_initial: '',
        address_line1: parentProfile.address_line1,
        address_line2: parentProfile.address_line2,
        city: parentProfile.city,
        state: parentProfile.state,
        zip: parentProfile.zip,
        country: parentProfile.country,
        cell_phone: parentProfile.cell_phone,
        home_phone: parentProfile.home_phone,
        email: parentProfile.email,
        birthdate: '',
        parent_id: parentProfile.id,
        disciplines: [],
        emergency_contact_name:
          parentProfile.first_name + ' ' + parentProfile.last_name,
        emergency_contact_phone: parentProfile.cell_phone,
        ama_number: '',
        profile_picture: null,
        member_type: 'Regular',
        membership_option: null,
        d14_number: null,
        last_modified: null,
        signature: null,
        date_signed: null,
        role: null,
        card_status: false,
      };
    } else {
      console.error('Parent profile is missing.');
    }
  }

  toggleNewFamilyMemberDiscipline(discipline: string) {
    if (this.newFamilyMember) {
      const updatedProfile = this.newFamilyMember;
      if (updatedProfile?.disciplines?.includes(discipline)) {
        updatedProfile.disciplines = updatedProfile.disciplines.filter(
          (d) => d !== discipline
        );
      } else {
        updatedProfile?.disciplines?.push(discipline);
      }
      this.newFamilyMember = updatedProfile;
    }
    this.cdr.detectChanges();
  }

  async addNewFamilyMember() {
    if (!this.newFamilyMember) {
      console.error('New family member data is missing.');
      return;
    }

    if (this.isAddingFamilyMember) return;
    this.isAddingFamilyMember = true;

    // Ensure newFamilyMember includes user_id
    const {
      id,
      d14_number,
      last_modified,
      middle_initial,
      profile_picture,
      role,
      ...newFamilyMemberData
    } = {
      ...this.newFamilyMember,
      user_id: null,
    };

    // Clean up any stale temp records for this parent before inserting
    const parentId = this.newFamilyMember.parent_id;
    if (parentId) {
      await this.clearExistingRenewals(parentId);
      await this.clearExistingTempMembershipData(parentId);
    }

    // put the new member in temp table supabase
    const { error: tempError } = await this.supabase.supabase
      .from('temp_membership_form_data')
      .insert(newFamilyMemberData);

    if (tempError) {
      console.error('Error adding new family member:', tempError.message);
      this.isAddingFamilyMember = false;
      return;
    }

    this.closeAddFamilyMemberModal();
    this.router.navigateByUrl('/secure/checkout');
  }

  openFullMembershipModal() {
    this.fullMembershipModal = true;
    this.cdr.detectChanges();
  }

  closeFullMembershipModal() {
    this.fullMembershipModal = false;
    this.amaNumber = '';
    this.cdr.detectChanges();
  }

  toggleNewFullMemberDiscipline(discipline: string) {
    if (this.fullMembershipDisciplines.includes(discipline)) {
      this.fullMembershipDisciplines = this.fullMembershipDisciplines.filter(
        (d) => d !== discipline
      );
    } else {
      this.fullMembershipDisciplines.push(discipline);
    }
    this.cdr.detectChanges();
  }

  async activateFullMembership() {
    // store the ama number in the temp table in supabase
    if (this.profile) {
      const parentProfile = this.profile.profile;
      await this.clearExistingRenewals(parentProfile.id);
      await this.clearExistingTempMembershipData(parentProfile.id);

      const {
        id,
        d14_number,
        last_modified,
        middle_initial,
        profile_picture,
        role,
        ...parentProfileData
      } = {
        ...parentProfile,
        user_id: parentProfile.id,
      };
      parentProfileData.ama_number = this.amaNumber;
      parentProfileData.member_type = 'Regular';
      parentProfileData.disciplines = this.fullMembershipDisciplines;

      const { error } = await this.supabase.supabase
        .from('temp_membership_form_data')
        .upsert(parentProfileData, { onConflict: 'user_id' });

      if (error) {
        console.error('Error storing full membership data:', error.message);
        return;
      }
    } else {
      console.error('Parent profile is missing.');
    }
    this.closeFullMembershipModal();
    this.router.navigateByUrl('/secure/checkout');
  }

  toggleTooltip(tooltip: MatTooltip) {
    this.activeTooltip = tooltip;
    if (tooltip._isTooltipVisible()) {
      tooltip.hide();
      this.activeTooltip = null;
    } else {
      tooltip.show();
    }
  }

  hideTooltip(tooltip: MatTooltip) {
    tooltip.hide();
    if (this.activeTooltip === tooltip) {
      this.activeTooltip = null;
    }
  }

  isCardViewDisabled(membershipUser: profileMembership): boolean {
    if (membershipUser.profile.parent_id) {
      return this.isMembershipExpired(membershipUser.membership?.expiration);
    }
    return this.isMembershipExpired(membershipUser.membership?.expiration);
  }
}

// Membership interface
export interface Membership {
  id: number;
  profile_id: string;
  date_created: string | null;
  expiration: string;
  last_modified: string | null;
}

// ProfileMembership interface
export interface profileMembership {
  profile: Profile;
  membership: Membership | null;
}

export interface renewalData {
  id: string;
  parent_id: string;
}
