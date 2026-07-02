import {
  Component,
  OnInit,
  ChangeDetectorRef,
  viewChild,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { faEllipsis, faNoteSticky } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { ToastrService } from 'ngx-toastr';
import { Profile } from '../models/models';
import { AuthService } from '../../../core/auth/auth.service';
import { Membership, profileMembership } from '../../profile/profile.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PhoneFormatPipe } from '../../contact/phone-format.pipe';
import { environment } from '../../../../environments/environment';
import { US_STATES } from '../../../shared/array/states';
import { CANADIAN_PROVINCES } from '../../../shared/array/provinces';
import { OrganizationManagementComponent } from '../organization-management/organization-management.component';
import { MembershipCardService } from '../../../shared/services/membership-card.service';

interface MembershipNote {
  id: number;
  membership_id?: string;
  admin_id?: string;
  note_content: string;
  last_modified: string;
  on_card: boolean;
}

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    MatTooltipModule,
    PhoneFormatPipe,
    OrganizationManagementComponent,
  ],
  standalone: true,
})
export class UserManagementComponent implements OnInit {
  faEllipsis = faEllipsis;
  faNoteSticky = faNoteSticky;

  selectedTab: 'user' | 'organization' = 'user';
  isChildMember: boolean = false;
  users: profileMembership[] = []; // Full list of users
  filteredUsers: profileMembership[] = []; // Filtered list of users based on search
  visibleUsers: profileMembership[] = []; // Paginated list of filtered users to display
  visibleNotes: string[] = [];
  isNoteOnCard: boolean = false;
  searchType: string = 'all';
  validParents: any[] = [];
  selectedUser: Profile | null = null;
  selectedUserComplete: profileMembership | null = null;

  newMember: Partial<Profile> & {
    parent_id?: string;
    date_created?: string;
    expiration?: string;
    card_status: boolean;
    is_family_user?: boolean;
  } = {
    disciplines: [],
    member_type: '',
    card_status: true,
    is_family_user: false,
  };
  STATES = US_STATES;
  PROVINCES = CANADIAN_PROVINCES;

  usersToDelete: profileMembership[] | null = null;
  divisions: any[] = [];

  memberNotes: MembershipNote[] = [];
  newNote: string = '';
  editingNoteId: number | null = null;

  savedSearch: string = '';
  currentPage: number = 1;
  usersPerPage: number = 20;
  totalPages: number = 0;
  membersOnly: boolean = false;
  hideExpired: boolean = false;
  memberTypeFilter: string = 'all';
  modificationSince: Date | null = null;
  modificationUntil: Date | null = null;
  parentsOnly: boolean = false;
  cardPrintUsers: boolean = false;
  availableFields: string[] = [
    'name',
    'email',
    'member type',
    'home phone',
    'cell phone',
    'birthdate',
    'address',
    'ama number',
    'D14 number',
    'expiration',
    'disciplines',
    'emergency Contact',
    'last modified',
  ];
  selectedFields: string[] = ['name', 'email', 'member type'];
  selectedDivisions: string[] = [];
  showAdvancedFilters: boolean = false;
  totalUsers: number = 0;

  selectedUsers: profileMembership[] = [];

  selectedDivision: string = '';
  selectUserChairmanDivision: string | null = null;

  searchString: string = '';
  parentMembers: Profile[] = [];
  selectedParent: Profile | null = null;

  isEditing: boolean = false;
  savedUserInfo: Profile | null = null;
  editedUserInfo: Profile | null = null;
  newExpiration: Date | null = null;

  memberTypeSummary: {
    Regular: { active: number; expired: number };
    Comped: { active: number; expired: number };
    Charter: { active: number; expired: number };
  } | null = null;

  newMembersSummary: {
    Regular: number;
    Comped: number;
    Charter: number;
  } | null = null;

  @ViewChild('membershipCard') membershipCard!: ElementRef;
  isCardModalOpen: boolean = false;
  logoDataUrl: string | null = null;
  profile: profileMembership | null = null;

  currentParentId: string | null = null;
  newParentId: string | null = null;

  constructor(
    private auth: AuthService,
    private supabaseService: SupabaseService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef,
    private membershipCardService: MembershipCardService
  ) {}

  ngOnInit(): void {
    this.fetchDivisions();
    this.fetchProfiles();
    this.loadLogoAsDataUrl();
  }

  async fetchProfiles() {
    try {
      const startIndex = (this.currentPage - 1) * this.usersPerPage;

      // Fetch profiles with memberships in a single query
      let profileQuery = this.supabaseService.supabase
        .from('profiles')
        .select('*, memberships(*)', { count: 'exact' }) // Use the relationship defined for memberships
        .range(startIndex, startIndex + this.usersPerPage - 1); // Pagination

      // Apply filters
      if (this.savedSearch) {
        const searchArray = this.savedSearch
          .split(' ')
          .map((term) => term.trim())
          .filter((term) => term.length > 0);

        let searchConditions = [];

        if (searchArray.length > 1) {
          // If there are two search terms, we need both conditions to apply with AND logic
          searchConditions.push(
            `and(first_name.ilike.%${searchArray[0]}%, last_name.ilike.%${searchArray[1]}%)`
          );
        } else if (searchArray.length === 1) {
          // If only one search term, match on first name, last name, or email with OR logic
          searchConditions.push(
            `first_name.ilike.%${searchArray[0]}%`,
            `last_name.ilike.%${searchArray[0]}%`,
            `email.ilike.%${searchArray[0]}%`
          );
        }

        // Apply the OR condition for all the search fields, or combined AND for first/last names
        profileQuery = profileQuery.or(searchConditions.join(','));
      }

      if (this.memberTypeFilter !== 'all') {
        profileQuery = profileQuery.eq('member_type', this.memberTypeFilter);
      }
      if (this.parentsOnly) {
        profileQuery = profileQuery.is('parent_id', null);
      }
      if (this.modificationSince) {
        profileQuery = profileQuery.gt('last_modified', this.modificationSince);
      }
      if (this.modificationUntil) {
        // Add 23:59:59 to make it end of day
        const endOfDay = new Date(this.modificationUntil);
        // Set to UTC time to avoid timezone issues
        endOfDay.setUTCHours(23, 59, 59, 999);
        profileQuery = profileQuery.lt('last_modified', endOfDay.toISOString());
      }
      if (this.membersOnly) {
        profileQuery = profileQuery.not('memberships', 'is', null);
      }
      if (this.cardPrintUsers) {
        profileQuery = profileQuery.eq('card_status', true);
      }
      if (this.hideExpired) {
        profileQuery = profileQuery.not(
          'memberships.expiration',
          'lt',
          new Date().toISOString()
        );
        profileQuery = profileQuery.not('memberships', 'is', null);
      }
      if (this.selectedDivisions.length > 0) {
        if (this.selectedDivisions.length !== this.divisions.length) {
          profileQuery = profileQuery.or(
            this.selectedDivisions
              .map((division) => `disciplines.cs.{${division}}`)
              .join(',')
          );
        }
      }

      // Execute the query
      const {
        data: profileData,
        count: numUsers,
        error: profileError,
      } = await profileQuery;

      if (profileError) {
        console.error('Error fetching profiles:', profileError.message);
        return;
      }

      // Map profileData to create profileMembership array
      this.users = profileData.map((profile) => ({
        profile, // The entire profile object
        membership: profile.memberships ? profile.memberships : null,
      })) as profileMembership[];

      // Handle pagination
      this.totalPages = Math.ceil(numUsers! / this.usersPerPage);

      this.totalUsers = numUsers ? numUsers : 0;

      // Update visible users based on the current page
      this.updateVisibleUsers();
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }

  clearAllFilters() {
    this.savedSearch = '';
    this.memberTypeFilter = 'all';
    this.modificationSince = null;
    this.modificationUntil = null;
    this.membersOnly = false;
    this.hideExpired = false;
    this.parentsOnly = false;
    this.selectedDivisions = [];
    this.currentPage = 1;
    this.fetchProfiles();
  }

  areFiltersActive(): boolean {
    if (this.memberTypeFilter !== 'all') return true;
    if (this.modificationSince) return true;
    if (this.modificationUntil) return true;
    if (this.membersOnly) return true;
    if (this.hideExpired) return true;
    if (this.parentsOnly) return true;
    if (
      this.selectedDivisions.length > 0 &&
      this.selectedDivisions.length < this.divisions.length
    )
      return true;
    return false;
  }

  isDateExpired(date: string): boolean {
    return new Date(date) < new Date();
  }

  async updateVisibleUsers() {
    this.visibleUsers = this.users;
    // map all ids to an array
    const visibleUserIds = this.visibleUsers.map((user) => user.profile.id);
    // find all ids that have a note
    const notes = await this.supabaseService.supabase
      .from('membership_notes')
      .select('membership_id')
      .in('membership_id', visibleUserIds);

    this.visibleNotes = notes.data?.map((note) => note.membership_id) || [];

    this.cdr.detectChanges();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.fetchProfiles(); // Fetch new profiles for the next page
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.fetchProfiles(); // Fetch new profiles for the previous page
    }
  }

  // Filtering functions remain the same, but ensure they call fetchProfiles()
  filterMembersBySearch() {
    this.currentPage = 1; // Reset to first page when searching
    this.fetchProfiles();
  }

  toggleMembersOnly() {
    this.membersOnly = !this.membersOnly;
    this.currentPage = 1; // Reset to first page when searching
    this.fetchProfiles();
  }

  toggleHideExpired() {
    this.hideExpired = !this.hideExpired;
    this.currentPage = 1; // Reset to first page when searching
    this.fetchProfiles();
  }

  filterByModDate() {
    this.currentPage = 1; // Reset to first page when searching
    if (!this.selectedFields.includes('last modified')) {
      this.selectedFields.push('last modified');
    } else {
      if (!(this.modificationSince || this.modificationUntil)) {
        this.selectedFields = this.selectedFields.filter(
          (field) => field !== 'last modified'
        );
      }
    }
    this.fetchProfiles();
  }

  filterByMemberType() {
    this.currentPage = 1; // Reset to first page when searching
    this.fetchProfiles();
  }

  toggleParentsOnly() {
    this.parentsOnly = !this.parentsOnly;
    this.currentPage = 1; // Reset to first page when searching
    this.fetchProfiles();
  }

  toggleCardPrintUsers() {
    this.cardPrintUsers = !this.cardPrintUsers;
    this.currentPage = 1; // Reset to first page when searching
    this.fetchProfiles();
  }

  // Handle search input changes
  async onSearchChange() {
    if (this.searchString.length >= 3) {
      // if search string has a space, split it and search for first and last name
      const searchArray = this.searchString.split(' ');
      let profileQuery = this.supabaseService.supabase
        .from('profiles')
        .select('*, memberships(*)') // Include relationships
        .limit(10);

      if (searchArray.length > 1) {
        profileQuery = profileQuery
          .or(`first_name.ilike.%${searchArray[0]}%`)
          .or(`last_name.ilike.%${searchArray[1]}%`);
      } else {
        profileQuery = profileQuery.or(
          `first_name.ilike.%${searchArray[0]}%,last_name.ilike.%${searchArray[0]}%`
        );
      }

      const { data: profileData, error: profileError } = await profileQuery;

      if (profileError) {
        console.error('Error fetching profiles:', profileError.message);
        return;
      }

      this.parentMembers = profileData as Profile[];
    } else {
      this.parentMembers = []; // Clear results if less than 3 characters
    }
  }

  // Handle user selection
  selectParentMember(user: Profile): void {
    this.selectedParent = user;
    this.cdr.detectChanges();
    this.newMember.parent_id = user.id; // Assuming newMember is defined in your component
    this.newMember.home_phone = user.home_phone;
    this.newMember.cell_phone = user.cell_phone;
    this.newMember.address_line1 = user.address_line1;
    this.newMember.address_line2 = user.address_line2;
    this.newMember.city = user.city;
    this.newMember.state = user.state;
    this.newMember.zip = user.zip;
    this.newMember.country = user.country;
    this.newMember.emergency_contact_name = `${user.first_name} ${user.last_name}`;
    this.newMember.emergency_contact_phone = user.cell_phone;
    this.searchString = ''; // Clear the search input
    this.parentMembers = []; // Clear parent members
  }

  enableEditing() {
    this.isEditing = true;
    this.savedUserInfo = JSON.parse(JSON.stringify(this.selectedUser));
    this.editedUserInfo = JSON.parse(JSON.stringify(this.selectedUser));

    // For family users, ensure we don't try to edit membership data
    if (this.selectedUser?.member_type === 'Family') {
      this.newExpiration = null;
    } else if (this.selectedUserComplete?.membership) {
      this.newExpiration = new Date(
        this.selectedUserComplete.membership.expiration
      );
    }

    this.cdr.detectChanges();
  }

  cancelEditing() {
    this.isEditing = false;
    this.editedUserInfo = this.savedUserInfo;
    this.cdr.detectChanges();
  }

  getAddress(user: any): {
    line1: string;
    line2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  } {
    return {
      line1: user.profile.address_line1,
      line2: user.profile.address_line2,
      city: user.profile.city,
      state: user.profile.state,
      zip: user.profile.zip,
      country: user.profile.country,
    };
  }

  getParentName(parentId: string | null): string {
    if (!parentId) return ''; // If there's no parent_id, return empty string
    const parentUser = this.users.find((user) => user.profile.id === parentId);
    return parentUser
      ? `${parentUser.profile.first_name} ${parentUser.profile.last_name}`
      : '';
  }

  async fetchDivisions() {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('divisions')
        .select('name');

      if (error) {
        console.error('Error fetching divisions:', error.message);
      } else if (data) {
        this.divisions = data;
        this.selectedDivisions = this.divisions.map(
          (division) => division.name
        );
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }

  async openModal(user: Profile) {
    this.selectedUser = JSON.parse(JSON.stringify(user));
    (document.getElementById('user_modal') as HTMLDialogElement).show();

    // For family users (member_type === 'Family'), we don't expect membership data
    if (user.member_type === 'Family') {
      this.selectedUserComplete = {
        profile: user,
        membership: null,
      };
      this.cdr.detectChanges();
      return;
    }

    // For regular members, fetch their membership data
    const { data, error } = await this.supabaseService.supabase
      .from('memberships')
      .select('*')
      .eq('profile_id', user.id);

    if (error) {
      return;
    }
    if (data && data.length > 0) {
      this.selectedUserComplete = {
        profile: user,
        membership: data[0] as Membership,
      };
    } else {
      return;
    }
    this.cdr.detectChanges();
  }

  closeModal() {
    this.selectedUser = null;
    this.selectedUserComplete = null;
    if (this.isEditing) {
      this.cancelEditing();
    }
    (document.getElementById('user_modal') as HTMLDialogElement).close();
  }

  closeModalTemp() {
    (document.getElementById('user_modal') as HTMLDialogElement).close();
  }

  openAddMemberModal() {
    this.newMember = {
      disciplines: [],
      member_type: '',
      card_status: true,
      is_family_user: false,
    }; // Reset the new member data with empty disciplines array
    (document.getElementById('add_member_modal') as HTMLDialogElement).show();
  }

  closeAddMemberModal() {
    this.newMember = {
      disciplines: [],
      card_status: true,
      is_family_user: false,
    }; // Reset the new member data
    (document.getElementById('add_member_modal') as HTMLDialogElement).close();
  }

  openFieldsModal() {
    (document.getElementById('fields_modal') as HTMLDialogElement).show();
  }

  closeFieldsModal() {
    (document.getElementById('fields_modal') as HTMLDialogElement).close();
  }

  async openChairmanModal() {
    if (this.selectedUser?.role === 'chairman') {
      try {
        const { data, error } = await this.supabaseService.supabase
          .from('divisions')
          .select('name')
          .eq('chairman_id', this.selectedUser.id);

        if (error) {
          console.error('Error fetching chairman divisions:', error.message);
          return;
        }

        if (data) {
          this.selectUserChairmanDivision = data[0].name;
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      }
    }
    (document.getElementById('chairman_modal') as HTMLDialogElement).show();
  }

  closeChairmanModal() {
    (document.getElementById('chairman_modal') as HTMLDialogElement).close();
  }

  async appointChairman(userId: string) {
    try {
      if (!this.selectedDivision) {
        console.error('Selected division is invalid');
        this.toastr.error('Selected division is invalid');
        return;
      }

      // Update the divisions table to set the chairman_id
      const { data, error: divisionError } = await this.supabaseService.supabase
        .from('divisions')
        .update({ chairman_id: userId })
        .eq('name', this.selectedDivision);

      if (divisionError) {
        console.error('Error updating divisions table:', divisionError.message);
        this.toastr.error('Error appointing chairman');
        return;
      }

      // Update the profile table to set the role to 'chairman'
      const { data: profileData, error: profileError } =
        await this.supabaseService.supabase
          .from('profiles')
          .update({ role: 'chairman' })
          .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile table:', profileError.message);
        this.toastr.error('Error updating user role');
        return;
      }

      this.toastr.success('Chairman appointed successfully');
      this.closeChairmanModal();
    } catch (error) {
      console.error('Unexpected error:', error);
      this.toastr.error('Unexpected error appointing chairman');
    }
  }

  async removeChairman(userId: string) {
    try {
      // Update the divisions table to set the chairman_id to null
      const { error: divisionError } = await this.supabaseService.supabase
        .from('divisions')
        .update({ chairman_id: null })
        .eq('chairman_id', userId);

      if (divisionError) {
        console.error('Error updating divisions table:', divisionError.message);
        this.toastr.error('Error removing chairman');
        return;
      }

      // Update the profile table to set the role to ''
      const { error: profileError } = await this.supabaseService.supabase
        .from('profiles')
        .update({ role: null })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile table:', profileError.message);
        this.toastr.error('Error updating user role');
        return;
      }

      this.toastr.success('Chairman removed successfully');
      this.closeChairmanModal();
    } catch (error) {
      console.error('Unexpected error:', error);
      this.toastr.error('Unexpected error removing chairman');
    }
  }

  async setAdmin(user: Profile) {
    if (!user) return;
    if (user.role === 'admin') {
      try {
        const { data, error } = await this.supabaseService.supabase
          .from('profiles')
          .update({ role: null })
          .eq('id', user.id);

        if (error) {
          console.error('Error updating profile:', error.message);
          this.toastr.error('Error updating profile');
          return;
        }

        this.toastr.success('Admin removed successfully');
      } catch (error) {
        console.error('Unexpected error:', error);
        this.toastr.error('Unexpected error removing admin');
      }
    } else {
      try {
        const { data, error } = await this.supabaseService.supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', user.id);

        if (error) {
          console.error('Error updating profile:', error.message);
          this.toastr.error('Error updating profile');
          return;
        }
        this.toastr.success('Admin set successfully');
      } catch (error) {
        console.error('Unexpected error:', error);
        this.toastr.error('Unexpected error setting admin');
      }
    }
    this.fetchProfiles();
    this.closeModal();
  }

  openAssignParentModal() {
    (
      document.getElementById('assign_parent_modal') as HTMLDialogElement
    ).show();
  }

  closeAssignParentModal() {
    (
      document.getElementById('assign_parent_modal') as HTMLDialogElement
    ).close();
  }

  async searchParent() {
    if (!this.searchString) return;
    if (this.searchString.length < 3) return;
    const searchArray = this.searchString.split(' ');

    let profileQuery = this.supabaseService.supabase
      .from('profiles')
      .select('*, memberships(*)') // Include relationships
      .is('parent_id', null) // Ensure parent_id is null
      .limit(10);

    if (searchArray.length > 1) {
      profileQuery = profileQuery
        .or(`first_name.ilike.%${searchArray[0]}%`)
        .or(`last_name.ilike.%${searchArray[1]}%`);
    } else {
      profileQuery = profileQuery.or(
        `first_name.ilike.%${searchArray[0]}%,last_name.ilike.%${searchArray[0]}%`
      );
    }

    const { data: profileData, error: profileError } = await profileQuery;

    if (profileError) {
      console.error('Error fetching profiles:', profileError.message);
      return;
    }

    this.parentMembers = profileData as Profile[];
    this.cdr.detectChanges();
  }

  async assignToParent() {
    // Check that a parent and users are selected
    if (
      !this.selectedParent ||
      !this.selectedUsers ||
      this.selectedUsers.length === 0
    )
      return;

    // Verify each selected user has no children
    for (const user of this.selectedUsers) {
      const { count: childCount, error: childCheckError } =
        await this.supabaseService.supabase
          .from('profiles')
          .select('id', { count: 'exact' })
          .eq('parent_id', user.profile.id);

      if (childCheckError) {
        console.error(
          'Error checking user for children:',
          childCheckError.message
        );
        this.toastr.error('Error checking user for children');
        return;
      }

      if (childCount && childCount > 0) {
        this.toastr.warning(
          `User ${user.profile.first_name} ${user.profile.last_name} has existing children and cannot be assigned as a child.`
        );
        return;
      }
    }

    // Get the count of existing children for the selected parent
    const { count: parentChildCount, error: parentError } =
      await this.supabaseService.supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .eq('parent_id', this.selectedParent.id);

    if (parentError) {
      console.error('Error fetching parent children:', parentError.message);
      return;
    }
    // Update each selected user with the new parent information
    for (const user of this.selectedUsers) {
      try {
        const response = await fetch(
          `${environment.supabaseUrl}/functions/v1/updateUser`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userID: user.profile.id,
              updateOptions: {
                address_line1: this.selectedParent.address_line1,
                address_line2: this.selectedParent.address_line2,
                city: this.selectedParent.city,
                state: this.selectedParent.state,
                zip: this.selectedParent.zip,
                country: this.selectedParent.country,
                emergency_contact_name: `${this.selectedParent.first_name} ${this.selectedParent.last_name}`,
                emergency_contact_phone: this.selectedParent.cell_phone,
                home_phone: this.selectedParent.home_phone,
                cell_phone: this.selectedParent.cell_phone,
                email: this.selectedParent.email,
                parent_id: this.selectedParent.id,
              },
              newExpiration: null,
            }),
          }
        );

        const result = await response.json();
        if (!response.ok || result.error) {
          console.error(
            'Error updating User:',
            result.error || 'Unknown error'
          );
          this.toastr.error('Error updating User');
          return;
        }
      } catch (error) {
        console.error('Error updating User:', error);
        this.toastr.error('Error updating User');
        return;
      }
    }

    this.toastr.success('Users updated successfully');
    this.selectedUsers = [];
    this.parentMembers = [];
    this.selectedParent = null;
    this.closeAssignParentModal();
    this.fetchProfiles();
  }

  toggleSelectedUser(user: profileMembership) {
    const index = this.selectedUsers.findIndex(
      (selectedUser) => selectedUser.profile.id === user.profile.id
    );
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(user);
    }
  }

  async toggleCardStatus() {
    if (!this.selectedUser) return;
    this.selectedUser.card_status = !this.selectedUser.card_status;
    const { error } = await this.supabaseService.supabase
      .from('profiles')
      .update({ card_status: this.selectedUser.card_status })
      .eq('id', this.selectedUser.id);

    if (error) {
      console.error('Error updating card status:', error.message);
      this.toastr.error('Error updating card status');
      return;
    }

    this.fetchProfiles();
    this.cdr.detectChanges();
  }

  toggleSelectedField(field: string) {
    const index = this.selectedFields.indexOf(field);
    if (index > -1) {
      this.selectedFields.splice(index, 1);
    } else {
      this.selectedFields.push(field);
    }
  }

  openDeleteConfirmModal(users: profileMembership[]) {
    this.usersToDelete = users;
    (
      document.getElementById('delete_confirm_modal') as HTMLDialogElement
    ).show();
  }

  closeDeleteConfirmModal() {
    this.usersToDelete = null;
    (
      document.getElementById('delete_confirm_modal') as HTMLDialogElement
    ).close();
  }

  async openParentModal(parent_id: String) {
    // query the db for the parent
    const {
      data: profileData,
      count: numUsers,
      error: profileError,
    } = await this.supabaseService.supabase
      .from('profiles')
      .select('*') // Select necessary fields and get exact count
      .eq('id', parent_id);

    if (profileError) {
      console.error('Error fetching profiles:', profileError.message);
      return;
    }
    const parent = profileData[0] as Profile;

    this.openModal(parent);
  }

  async deleteUser() {
    if (!this.usersToDelete) return;
    try {
      for (const user of this.usersToDelete) {
        const response = await fetch(
          `${environment.supabaseUrl}/functions/v1/deleteUser`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              profile_id: user.profile.id,
            }),
          }
        );

        if (response.status === 204 || response.ok) {
          this.filteredUsers = this.filteredUsers.filter(
            (user) => user.profile.id !== user.profile.id
          );
          this.closeDeleteConfirmModal();
        } else {
          const result = await response.json();
          this.toastr.error(result.error || 'Error deleting user');
        }
      }
      this.toastr.success('Users deleted successfully');
      this.selectedUsers = [];
      this.fetchProfiles();
    } catch (error) {
      console.error('Unexpected error:', error);
      this.toastr.error('Unexpected error deleting user');
    }
  }

  toggleChildMember() {
    this.isChildMember = !this.isChildMember;

    // If this is a child member, it cannot be a family user
    if (this.isChildMember) {
      this.newMember.is_family_user = false;
    }

    this.cdr.detectChanges();
  }

  // Populate fields when a parent is selected
  async populateFromParentMember() {
    if (this.newMember.parent_id) {
      const { data: parentData, error: parentError } =
        await this.supabaseService.supabase
          .from('profiles')
          .select('*')
          .eq('id', this.newMember.parent_id);

      if (parentError) {
        console.error('Error fetching parent:', parentError.message);
        return;
      }

      const parentMember = parentData[0] as Profile;

      if (parentMember) {
        // Extract base email without any +child suffix
        const baseEmail = parentMember.email.replace(/\+child\d+@/, '@');
        this.newMember.email = baseEmail;
        this.newMember.home_phone = parentMember.home_phone;
        this.newMember.cell_phone = parentMember.cell_phone;
        this.newMember.address_line1 = parentMember.address_line1;
        this.newMember.address_line2 = parentMember.address_line2;
        this.newMember.city = parentMember.city;
        this.newMember.state = parentMember.state;
        this.newMember.zip = parentMember.zip;
        this.newMember.country = parentMember.country;
        this.newMember.emergency_contact_name =
          parentMember.first_name + ' ' + parentMember.last_name;
        this.newMember.emergency_contact_phone = parentMember.cell_phone;
        this.newMember.member_type = 'Regular';
      }
    }
  }

  async addMember() {
    try {
      if (this.isChildMember) {
        await this.populateFromParentMember();
      }

      // Prepare the new member data with the user-selected member_type
      const requestData: any = {
        ...this.newMember,
        password: 'TemporaryPassword123', // Default temporary password
      };

      // For family users, we don't create a membership at all
      if (this.newMember.is_family_user) {
        // Explicitly set flag to skip membership creation entirely
        requestData.skip_membership = true;
        // Set member_type to 'Family' for clarity
        requestData.member_type = 'Family';
        // Remove any membership-related fields that might be present
        delete requestData.expiration;
        delete requestData.date_created;
        delete requestData.ama_number;
      }

      // Send the request to create the user
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
        this.toastr.success(
          this.newMember.is_family_user
            ? 'Family user added successfully (no membership)'
            : 'Member added successfully'
        );
      } else {
        console.error('Error creating new user:', result.error);
        this.toastr.error('Error creating user');
        return;
      }

      this.newMember = {
        disciplines: [],
        card_status: true,
        is_family_user: false,
      }; // Reset the new member data
      this.fetchProfiles();
      this.closeAddMemberModal();
    } catch (error) {
      console.error('Unexpected error:', error);
      this.toastr.error('Unexpected error adding member');
    }
  }

  toggleDisciplineChange(disciplineName: string) {
    if (!this.editedUserInfo) return;
    // if the dicsipline is already in the array, remove it otherwise add it
    const index = this.editedUserInfo.disciplines
      ? this.editedUserInfo.disciplines.indexOf(disciplineName)
      : -1;
    if (this.editedUserInfo.disciplines) {
      if (index > -1) {
        this.editedUserInfo.disciplines.splice(index, 1);
      } else {
        this.editedUserInfo.disciplines.push(disciplineName);
      }
    }
  }

  async saveChanges() {
    if (!this.editedUserInfo) return;
    this.editedUserInfo.last_modified = new Date().toISOString();

    try {
      // Check if user is being converted to a family user
      const isConvertingToFamily =
        this.editedUserInfo.member_type === 'Family' &&
        this.selectedUser?.member_type !== 'Family';

      // Send the updated profile information to the updateUser cloud function
      const response = await fetch(
        `${environment.supabaseUrl}/functions/v1/updateUser`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userID: this.editedUserInfo.id,
            updateOptions: {
              first_name: this.editedUserInfo.first_name,
              middle_initial: this.editedUserInfo.middle_initial,
              last_name: this.editedUserInfo.last_name,
              email: this.editedUserInfo.email,
              home_phone: this.editedUserInfo.home_phone,
              cell_phone: this.editedUserInfo.cell_phone,
              address_line1: this.editedUserInfo.address_line1,
              address_line2: this.editedUserInfo.address_line2,
              city: this.editedUserInfo.city,
              state: this.editedUserInfo.state,
              zip: this.editedUserInfo.zip,
              ama_number: this.editedUserInfo.ama_number,
              disciplines: this.editedUserInfo.disciplines,
              member_type: this.editedUserInfo.member_type,
              last_modified: this.editedUserInfo.last_modified,
            },
            newExpiration: this.newExpiration,
            // Add flag to delete membership if converting to family user
            deleteMembership: isConvertingToFamily,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || result.error) {
        console.error('Error updating User:', result.error || 'Unknown error');
        this.toastr.error('Error updating User');
        return;
      }

      // Show appropriate success message
      if (isConvertingToFamily) {
        this.toastr.success(
          'User converted to family user (membership removed)'
        );
      } else {
        this.toastr.success('User updated successfully');
      }

      // Update the UI and reset editing state
      this.fetchProfiles();
      this.selectedUser = this.editedUserInfo;

      // If converting to family user, set membership to null
      if (isConvertingToFamily && this.selectedUserComplete) {
        this.selectedUserComplete.membership = null;
      }
      // Otherwise update expiration if applicable
      else if (
        this.selectedUserComplete &&
        this.selectedUserComplete.membership?.expiration &&
        this.newExpiration
      ) {
        this.selectedUserComplete.membership.expiration =
          this.newExpiration.toString();
      }

      this.cdr.detectChanges();
      this.isEditing = false;
    } catch (error) {
      console.error('Error updating User:', error);
      this.toastr.error('Error updating User');
    }
  }

  toggleDiscipline(discipline: string) {
    if (!this.newMember.disciplines) {
      this.newMember.disciplines = [];
    }
    const index = this.newMember.disciplines.indexOf(discipline);
    if (index > -1) {
      this.newMember.disciplines.splice(index, 1);
    } else {
      this.newMember.disciplines.push(discipline);
    }
  }

  isDisciplineSelected(discipline: string): boolean {
    return this.newMember.disciplines?.includes(discipline) || false;
  }

  openAddNotesModal(user: Profile) {
    this.selectedUser = user;
    this.fetchMemberNotes(user.id);
    (document.getElementById('add_notes_modal') as HTMLDialogElement).show();
  }

  closeAddNotesModal() {
    this.selectedUser = null;
    this.newNote = '';
    this.memberNotes = [];
    (document.getElementById('add_notes_modal') as HTMLDialogElement).close();
  }

  async fetchMemberNotes(memberId: string) {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('membership_notes')
        .select('id, note_content, last_modified, on_card')
        .eq('membership_id', memberId)
        .order('last_modified', { ascending: false });

      if (error) {
        console.error('Error fetching member notes:', error.message);
        this.toastr.error('Error fetching member notes');
      } else if (data) {
        this.memberNotes = data;
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      this.toastr.error('Unexpected error fetching member notes');
    }
  }

  async addOrUpdateNote() {
    if (
      !this.selectedUser ||
      !this.newNote.trim() ||
      !this.auth.session?.user.id
    )
      return;

    try {
      if (this.editingNoteId) {
        const { error } = await this.supabaseService.supabase
          .from('membership_notes')
          .update({
            note_content: this.newNote.trim(),
            last_modified: new Date().toISOString(),
            on_card: this.isNoteOnCard, // New field for marking as on_card
          })
          .eq('id', this.editingNoteId);

        if (error) throw error;
        this.toastr.success('Note updated successfully');
      } else {
        const { error } = await this.supabaseService.supabase
          .from('membership_notes')
          .insert({
            membership_id: this.selectedUser.id,
            admin_id: this.auth.session.user.id,
            note_content: this.newNote.trim(),
            last_modified: new Date().toISOString(),
            on_card: this.isNoteOnCard, // New field for marking as on_card
          });

        if (error) throw error;
        this.toastr.success('Note added successfully');
      }

      this.newNote = '';
      this.isNoteOnCard = false; // Reset the on_card state
      this.editingNoteId = null;
      await this.fetchMemberNotes(this.selectedUser.id);
    } catch (error) {
      console.error('Error adding/updating note:', error);
      this.toastr.error('Error adding/updating note');
    }
  }

  editNote(note: MembershipNote) {
    this.editingNoteId = note.id;
    this.newNote = note.note_content;
  }

  async deleteNote(noteId: number) {
    try {
      const { error } = await this.supabaseService.supabase
        .from('membership_notes')
        .delete()
        .eq('id', noteId);

      if (error) {
        console.error('Error deleting note:', error.message);
        this.toastr.error('Error deleting note');
      } else {
        this.toastr.success('Note deleted successfully');
        if (this.selectedUser) {
          await this.fetchMemberNotes(this.selectedUser.id);
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      this.toastr.error('Unexpected error deleting note');
    }
  }

  async openMembershipCardModal() {
    if (!this.selectedUser) return;
    const { data, error } = await this.supabaseService.supabase
      .from('memberships')
      .select('*')
      .eq('profile_id', this.selectedUser?.id);

    if (error) {
      console.error('Error fetching membership:', error.message);
      this.toastr.error('Error fetching membership');
      return;
    }

    if (!data || data.length === 0) {
      this.toastr.error('No membership found for user');
      return;
    }

    this.selectedUserComplete = {
      profile: this.selectedUser,
      membership: data[0],
    };

    await this.fetchMemberNotes(this.selectedUser.id);

    this.isCardModalOpen = true;
    this.closeModalTemp();
  }

  closeMembershipCardModal() {
    this.isCardModalOpen = false;
    if (this.selectedUser) {
      this.openModal(this.selectedUser);
      this.cdr.detectChanges();
    }
  }

  printMembershipCard(profile: profileMembership) {
    if (!profile || !profile.membership || !this.logoDataUrl) {
      console.error('Unable to print membership card: missing required data');
      return;
    }

    this.membershipCardService.printMembershipCard(
      profile,
      this.logoDataUrl,
      this.memberNotes
    );

    this.closeMembershipCardModal();
  }

  async batchExportMembers() {
    try {
      this.toastr.info('Preparing export, please wait...');
      let allProfiles: any[] = [];

      // If there are selected users, just export those
      if (this.selectedUsers && this.selectedUsers.length > 0) {
        console.log('Exporting selected users:', this.selectedUsers.length);
        const selectedIds = this.selectedUsers.map((user) => user.profile.id);
        const { data: profilesWithNotes, error: profileError } =
          await this.supabaseService.supabase
            .from('profiles')
            .select(
              `
              *,
              memberships!inner(*),
              membership_notes!membership_id(*)
            `
            )
            .in('id', selectedIds);

        if (profileError) {
          throw new Error(`Error fetching profiles: ${profileError.message}`);
        }

        allProfiles = profilesWithNotes;
        console.log('Profiles with notes:', allProfiles);
      } else {
        // Use pagination to fetch all profiles beyond Supabase's 1000-row limit
        const batchSize = 1000;
        let offset = 0;
        let hasMore = true;

        console.log('Fetching all profiles with pagination...');

        while (hasMore) {
          let profileQuery = this.supabaseService.supabase
            .from('profiles')
            .select(
              `
              *,
              memberships!inner(*),
              membership_notes!membership_id(*)
            `,
              { count: 'exact' }
            );

          // Apply filters using the same logic as fetchProfiles
          if (this.savedSearch) {
            const searchArray = this.savedSearch
              .split(' ')
              .map((term) => term.trim())
              .filter((term) => term.length > 0);

            let searchConditions = [];

            if (searchArray.length > 1) {
              searchConditions.push(
                `and(first_name.ilike.%${searchArray[0]}%, last_name.ilike.%${searchArray[1]}%)`
              );
            } else if (searchArray.length === 1) {
              searchConditions.push(
                `first_name.ilike.%${searchArray[0]}%`,
                `last_name.ilike.%${searchArray[0]}%`,
                `email.ilike.%${searchArray[0]}%`
              );
            }

            profileQuery = profileQuery.or(searchConditions.join(','));
          }

          if (this.memberTypeFilter !== 'all') {
            profileQuery = profileQuery.eq('member_type', this.memberTypeFilter);
          }
          if (this.parentsOnly) {
            profileQuery = profileQuery.is('parent_id', null);
          }
          if (this.modificationSince) {
            profileQuery = profileQuery.gt(
              'last_modified',
              this.modificationSince
            );
          }
          if (this.modificationUntil) {
            // Add 23:59:59 to make it end of day
            const endOfDay = new Date(this.modificationUntil);
            endOfDay.setUTCHours(23, 59, 59, 999);
            profileQuery = profileQuery.lt(
              'last_modified',
              endOfDay.toISOString()
            );
          }
          if (this.membersOnly) {
            profileQuery = profileQuery.not('memberships', 'is', null);
          }
          if (this.cardPrintUsers) {
            profileQuery = profileQuery.eq('card_status', true);
          }
          if (this.hideExpired) {
            profileQuery = profileQuery.not(
              'memberships.expiration',
              'lt',
              new Date().toISOString()
            );
            profileQuery = profileQuery.not('memberships', 'is', null);
          }
          if (this.selectedDivisions.length > 0) {
            if (this.selectedDivisions.length !== this.divisions.length) {
              profileQuery = profileQuery.or(
                this.selectedDivisions
                  .map((division) => `disciplines.cs.{${division}}`)
                  .join(',')
              );
            }
          }

          // Apply pagination
          profileQuery = profileQuery.range(offset, offset + batchSize - 1);

          const {
            data: profileData,
            error: profileError,
            count,
          } = await profileQuery;

          if (profileError) {
            throw new Error(`Error fetching profiles: ${profileError.message}`);
          }

          if (profileData && profileData.length > 0) {
            allProfiles = allProfiles.concat(profileData);
            offset += batchSize;
            console.log(
              `Fetched ${allProfiles.length} profiles so far out of ${count} total`
            );

            // Check if we've fetched all profiles
            if (profileData.length < batchSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        if (allProfiles.length === 0) {
          this.toastr.warning('No profiles found matching the current filters');
          return;
        }

        console.log(`Fetched all ${allProfiles.length} profiles`);
      }

      console.log(`Total profiles to export: ${allProfiles.length}`);

      // Export profiles to CSV
      await this.exportProfilesToCSV(allProfiles);

      // Update card status after successful export
      if (this.cardPrintUsers) {
        this.toastr.info('Updating card status...');
        for (const profile of allProfiles) {
          await this.supabaseService.supabase
            .from('profiles')
            .update({ card_status: false })
            .eq('id', profile.id);
        }
        this.toastr.success('Card status updated successfully');
      }
    } catch (error) {
      console.error('Error exporting profiles:', error);
      this.toastr.error(
        'Error exporting profiles: ' + (error as Error).message
      );
    }
  }

  async exportProfilesToCSV(profiles: any[]) {
    if (!profiles || profiles.length === 0) {
      this.toastr.error('No profiles to export');
      return;
    }

    try {
      // Create an array of CSV rows
      const csvRows = [];

      // Define the headers for the CSV
      const headers = [
        'First Name',
        'Last Name',
        'Birthdate',
        'D14 Number',
        'Address Line 1',
        'Address Line 2',
        'City',
        'State',
        'Zip',
        'Membership Expiration',
        'Member Type',
        'Email',
        'Phone',
        'Notes',
      ];
      csvRows.push(headers.join(','));

      // Loop through the profiles and convert them to CSV rows
      for (const profile of profiles) {
        // Safely get membership expiration - modified version
        let membership = 'N/A';
        if (profile.memberships) {
          // Check if memberships is an array or object
          const membershipData = Array.isArray(profile.memberships)
            ? profile.memberships[0]
            : profile.memberships;
          if (membershipData && membershipData.expiration) {
            const date = new Date(membershipData.expiration);
            // Format as MM/DD/YYYY
            membership = `${(date.getMonth() + 1)
              .toString()
              .padStart(2, '0')}/${date
              .getDate()
              .toString()
              .padStart(2, '0')}/${date.getFullYear()}`;
          }
        }

        // Get on-card notes for this profile
        const notes = profile.membership_notes || [];
        console.log('Notes for profile:', notes);
        const notesString = notes
          .filter((note: any) => note.on_card === true)
          .map((note: { note_content: string }) => note.note_content)
          .join('; ');
        console.log('Filtered notes string:', notesString);

        // Escape and clean data fields
        const escapeCsvField = (field: any) => {
          if (field === null || field === undefined) return '';
          const stringField = String(field);
          if (
            stringField.includes(',') ||
            stringField.includes('"') ||
            stringField.includes('\n')
          ) {
            return `"${stringField.replace(/"/g, '""')}"`;
          }
          return stringField;
        };

        const row = [
          escapeCsvField(profile.first_name),
          escapeCsvField(profile.last_name),
          escapeCsvField(profile.birthdate),
          escapeCsvField(profile.d14_number),
          escapeCsvField(profile.address_line1),
          escapeCsvField(profile.address_line2),
          escapeCsvField(profile.city),
          escapeCsvField(profile.state),
          escapeCsvField(profile.zip),
          escapeCsvField(membership),
          escapeCsvField(profile.member_type),
          escapeCsvField(profile.email),
          escapeCsvField(profile.cell_phone || profile.home_phone),
          escapeCsvField(notesString),
        ];
        csvRows.push(row.join(','));
      }

      // Convert array to a string
      const csvString = csvRows.join('\n');

      // Create a Blob from the CSV string and create a downloadable link
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      const date = new Date().toISOString().split('T')[0];
      a.setAttribute('download', `d14_members_export_${date}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.toastr.success(`Successfully exported ${profiles.length} profiles`);
    } catch (error) {
      console.error('Error exporting profiles to CSV:', error);
      this.toastr.error('Error creating CSV export');
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

  openMembershipReportModal() {
    (
      document.getElementById('membership_report_modal') as HTMLDialogElement
    ).show();
    this.generateMembershipReport();
  }

  closeMembershipReportModal() {
    (
      document.getElementById('membership_report_modal') as HTMLDialogElement
    ).close();
  }

  async generateMembershipReport() {
    try {
      if (!this.memberTypeSummary) {
        const { count: expiredRegularCount, error: expiredMembershipsError } =
          await this.supabaseService.supabase
            .from('memberships')
            .select('*, profiles!inner(member_type)', { count: 'exact' }) // Select memberships and related profiles
            .eq('profiles.member_type', 'Regular') // Filter for profiles with member_type = 'Regular'
            .lt('expiration', new Date().toISOString()); // Filter for expired memberships

        if (expiredMembershipsError) {
          console.error(
            'Error fetching expired memberships count for regular profiles:',
            expiredMembershipsError.message
          );
          this.toastr.error('Error generating expired membership count');
        }

        const { count: activeRegularCount, error: activeMembershipsError } =
          await this.supabaseService.supabase
            .from('memberships')
            .select('*, profiles!inner(member_type)', { count: 'exact' }) // Select memberships and related profiles
            .eq('profiles.member_type', 'Regular') // Filter for profiles with member_type = 'Regular'
            .gt('expiration', new Date().toISOString()); // Filter for active memberships

        if (activeMembershipsError) {
          console.error(
            'Error fetching active memberships count for regular profiles:',
            activeMembershipsError.message
          );
          this.toastr.error('Error generating active membership count');
        }

        const { count: expiredCompedCount, error: expiredCompedError } =
          await this.supabaseService.supabase
            .from('memberships')
            .select('*, profiles!inner(member_type)', { count: 'exact' }) // Select memberships and related profiles
            .eq('profiles.member_type', 'Comped') // Filter for profiles with member_type = 'Comped'
            .lt('expiration', new Date().toISOString()); // Filter for expired memberships

        if (expiredCompedError) {
          console.error(
            'Error fetching expired memberships count for comped profiles:',
            expiredCompedError.message
          );
          this.toastr.error('Error generating expired membership count');
        }

        const { count: activeCompedCount, error: activeCompedError } =
          await this.supabaseService.supabase
            .from('memberships')
            .select('*, profiles!inner(member_type)', { count: 'exact' }) // Select memberships and related profiles
            .eq('profiles.member_type', 'Comped') // Filter for profiles with member_type = 'Comped'
            .gt('expiration', new Date().toISOString()); // Filter for active memberships

        if (activeCompedError) {
          console.error(
            'Error fetching active memberships count for comped profiles:',
            activeCompedError.message
          );
          this.toastr.error('Error generating active membership count');
        }

        const { count: expiredCharterCount, error: expiredCharterError } =
          await this.supabaseService.supabase
            .from('memberships')
            .select('*, profiles!inner(member_type)', { count: 'exact' }) // Select memberships and related profiles
            .eq('profiles.member_type', 'Charter') // Filter for profiles with member_type = 'Charter'
            .lt('expiration', new Date().toISOString()); // Filter for expired memberships

        if (expiredCharterError) {
          console.error(
            'Error fetching expired memberships count for charter profiles:',
            expiredCharterError.message
          );
          this.toastr.error('Error generating expired membership count');
        }

        const { count: activeCharterCount, error: activeCharterError } =
          await this.supabaseService.supabase
            .from('memberships')
            .select('*, profiles!inner(member_type)', { count: 'exact' }) // Select memberships and related profiles
            .eq('profiles.member_type', 'Charter') // Filter for profiles with member_type = 'Charter'
            .gt('expiration', new Date().toISOString()); // Filter for active memberships

        if (activeCharterError) {
          console.error(
            'Error fetching active memberships count for charter profiles:',
            activeCharterError.message
          );
          this.toastr.error('Error generating active membership count');
        }

        if (
          activeCharterCount !== null &&
          activeCompedCount !== null &&
          activeRegularCount !== null &&
          expiredCharterCount !== null &&
          expiredCompedCount !== null &&
          expiredRegularCount !== null
        ) {
          this.memberTypeSummary = {
            Regular: {
              expired: expiredRegularCount,
              active: activeRegularCount,
            },
            Comped: {
              expired: expiredCompedCount,
              active: activeCompedCount,
            },
            Charter: {
              expired: expiredCharterCount,
              active: activeCharterCount,
            },
          };
        }

        this.cdr.detectChanges();
      }

      if (!this.newMembersSummary) {
        const { count: newRegularCount, error: newRegularError } =
          await this.supabaseService.supabase
            .from('memberships')
            .select('*, profiles!inner(member_type)', { count: 'exact' }) // Select memberships and related profiles
            .eq('profiles.member_type', 'Regular') // Filter for profiles with member_type = 'Regular'
            .gt(
              'date_created',
              new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
            ); // Filter for new memberships within 90 days

        if (newRegularError) {
          console.error(
            'Error fetching new memberships count for regular profiles:',
            newRegularError.message
          );
          this.toastr.error('Error generating new membership count');
        }

        const { count: newCharterCount, error: newCharterError } =
          await this.supabaseService.supabase
            .from('memberships')
            .select('*, profiles!inner(member_type)', { count: 'exact' }) // Select memberships and related profiles
            .eq('profiles.member_type', 'Charter') // Filter for profiles with member_type = 'Regular'
            .gt(
              'date_created',
              new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
            ); // Filter for new memberships within 90 days

        if (newCharterError) {
          console.error(
            'Error fetching new memberships count for charter profiles:',
            newCharterError.message
          );
          this.toastr.error('Error generating new membership count');
        }

        const { count: newCompedCount, error: newCompedError } =
          await this.supabaseService.supabase
            .from('memberships')
            .select('*, profiles!inner(member_type)', { count: 'exact' }) // Select memberships and related profiles
            .eq('profiles.member_type', 'Comped') // Filter for profiles with member_type = 'Regular'
            .gt(
              'date_created',
              new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
            ); // Filter for new memberships within 90 days

        if (newCompedError) {
          console.error(
            'Error fetching new memberships count for comped profiles:',
            newCompedError.message
          );
          this.toastr.error('Error generating new membership count');
        }

        if (
          newRegularCount !== null &&
          newCharterCount !== null &&
          newCompedCount !== null
        ) {
          this.newMembersSummary = {
            Regular: newRegularCount,
            Comped: newCompedCount,
            Charter: newCharterCount,
          };
        }

        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      this.toastr.error('Unexpected error generating membership report');
    }
  }

  openDivisionsModal() {
    (document.getElementById('divisions_modal') as HTMLDialogElement).show();
  }

  closeDivisionsModal() {
    (document.getElementById('divisions_modal') as HTMLDialogElement).close();
  }

  toggleDivisionFilter(divisionName: string) {
    const index = this.selectedDivisions.indexOf(divisionName);
    if (index > -1) {
      this.selectedDivisions.splice(index, 1);
    } else {
      this.selectedDivisions.push(divisionName);
    }
    this.fetchProfiles();
  }

  openRenewModal() {
    (document.getElementById('renew_modal') as HTMLDialogElement).show();
  }

  closeRenewModal() {
    (document.getElementById('renew_modal') as HTMLDialogElement).close();
  }

  async renewMembership(userID: string) {
    // Get membership info
    const { data: membershipData, error: membershipError } =
      await this.supabaseService.supabase
        .from('memberships')
        .select('*')
        .eq('profile_id', userID);

    if (membershipError) {
      console.error('Error fetching membership:', membershipError.message);
      this.toastr.error('Error fetching membership');
      return;
    }

    if (!membershipData || membershipData.length === 0) {
      this.toastr.error('No membership found for user');
      return;
    }

    const membership = membershipData[0];

    // Renew membership
    const today = new Date();
    let newExpirationDate: Date;
    const currentExpiration = new Date(membership.expiration);
    console.log(currentExpiration);

    if (currentExpiration < today) {
      // If membership is expired, set expiration to 1 year from today
      newExpirationDate = new Date(today);
      newExpirationDate.setFullYear(today.getFullYear() + 1);
    } else {
      // If membership is not expired, add 1 year to current expiration
      newExpirationDate = new Date(currentExpiration);
      newExpirationDate.setFullYear(currentExpiration.getFullYear() + 1);
    }

    const { error: updateError } = await this.supabaseService.supabase
      .from('memberships')
      .update({
        expiration: newExpirationDate.toISOString(),
        last_modified: new Date().toISOString(),
      })
      .eq('profile_id', userID);

    if (updateError) {
      console.error('Error renewing membership:', updateError.message);
      this.toastr.error('Error renewing membership');
      return;
    }

    const { error: receiptError } = await this.supabaseService.supabase
      .from('membership_receipts')
      .insert({
        profile_id: userID,
        amount_paid: this.selectedUser?.member_type === 'Charter' ? 25 : 15,
        date_created: new Date().toISOString(),
        payment_method: 'cash/check',
      });

    if (receiptError) {
      console.error('Error creating receipt:', receiptError.message);
      this.toastr.error('Error creating receipt');
      return;
    }

    this.toastr.success('Membership renewed successfully');
    this.fetchProfiles();
    this.closeRenewModal();
  }

  openReassignParentModal() {
    if (this.selectedUsers.length < 1) {
      this.toastr.error('Please select a family member');
      return;
    }

    // Get all family members and set as selected
    this.selectedUsers = this.getFamilyMembers(this.selectedUsers[0]);

    // Find the current parent
    const parentUser = this.selectedUsers.find(
      (user) => !user.profile.parent_id
    );
    if (parentUser) {
      this.currentParentId = parentUser.profile.id;
    }

    (
      document.getElementById('reassign_parent_modal') as HTMLDialogElement
    ).show();
  }

  closeReassignParentModal() {
    this.currentParentId = null;
    this.newParentId = null;
    (
      document.getElementById('reassign_parent_modal') as HTMLDialogElement
    ).close();
  }

  async reassignParent() {
    if (!this.newParentId) return;

    try {
      // 1. Save the old parent and the new parent
      const newParentProfile = this.selectedUsers.find(
        (user) => user.profile.id === this.newParentId
      )?.profile;
      const oldParentProfile = this.selectedUsers.find(
        (user) => user.profile.id === this.currentParentId
      )?.profile;

      if (!newParentProfile || !oldParentProfile || !oldParentProfile.email) {
        throw new Error('Parent profiles or email not found');
      }

      const mainEmail = oldParentProfile.email.replace(/\+child\d+@/, '@');
      console.log('newParentProfile', newParentProfile);
      console.log('oldParentProfile', oldParentProfile);
      console.log('mainEmail', mainEmail);

      const children = this.selectedUsers.filter(
        (user) =>
          user.profile.id !== this.newParentId &&
          user.profile.id !== this.currentParentId
      );

      // 2. Change old parent to temp email
      let response = await fetch(
        `${environment.supabaseUrl}/functions/v1/updateUser`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userID: oldParentProfile.id,
            updateOptions: {
              email: `temp_${Date.now()}@temp.com`,
            },
            newExpiration: null,
          }),
        }
      );

      let result = await response.json();
      if (!response.ok || result.error) {
        throw result.error || 'Error updating old parent email';
      }

      // 3. Update new parent with main email and clear parent_id
      response = await fetch(
        `${environment.supabaseUrl}/functions/v1/updateUser`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userID: this.newParentId,
            updateOptions: {
              parent_id: null,
              email: mainEmail,
            },
            newExpiration: null,
          }),
        }
      );

      result = await response.json();
      if (!response.ok || result.error) {
        throw result.error || 'Error updating new parent';
      }

      // 4. Update all other children
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        response = await fetch(
          `${environment.supabaseUrl}/functions/v1/updateUser`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userID: child.profile.id,
              updateOptions: {
                parent_id: this.newParentId,
                email: mainEmail.replace('@', `+child${i + 1}@`),
              },
              newExpiration: null,
            }),
          }
        );

        result = await response.json();
        if (!response.ok || result.error) {
          throw result.error || 'Error updating child';
        }
      }

      // 5. Update old parent to be a child of new parent
      response = await fetch(
        `${environment.supabaseUrl}/functions/v1/updateUser`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userID: oldParentProfile.id,
            updateOptions: {
              parent_id: this.newParentId,
              email: mainEmail.replace('@', `+child${children.length + 1}@`),
            },
            newExpiration: null,
          }),
        }
      );

      result = await response.json();
      if (!response.ok || result.error) {
        throw result.error || 'Error updating old parent to child';
      }

      this.toastr.success('Parent reassigned successfully');
      this.fetchProfiles();
      this.closeReassignParentModal();
      this.selectedUsers = [];
    } catch (error) {
      console.error('Error reassigning parent:', error);
      this.toastr.error('Error reassigning parent');
    }
  }

  // Modify the areSameFamily method
  areSameFamily(users: profileMembership[]): boolean {
    if (users.length === 0) return false;

    // If only one user is selected, check if they have family members
    if (users.length === 1) {
      const user = users[0];
      const familyMembers = this.getFamilyMembers(user);
      return familyMembers.length > 1; // Return true if there are family members
    }

    // For multiple selections, keep existing logic
    const firstUserParentId = users[0].profile.parent_id || users[0].profile.id;
    return users.every(
      (user) =>
        user.profile.parent_id === firstUserParentId ||
        user.profile.id === firstUserParentId
    );
  }

  // Add this method to get all family members
  getFamilyMembers(user: profileMembership): profileMembership[] {
    const parentId = user.profile.parent_id || user.profile.id;
    return this.users.filter(
      (u) =>
        u.profile.id === parentId || // Include parent
        u.profile.parent_id === parentId // Include children
    );
  }

  openResetPasswordModal(user: Profile) {
    this.selectedUser = user;
    (
      document.getElementById('reset_password_modal') as HTMLDialogElement
    ).show();
  }

  closeResetPasswordModal() {
    (
      document.getElementById('reset_password_modal') as HTMLDialogElement
    ).close();
  }

  async resetUserPassword(user: Profile) {
    try {
      const { error } =
        await this.supabaseService.supabase.auth.resetPasswordForEmail(
          user.email,
          {
            redirectTo: `${window.location.origin}/login`,
          }
        );

      if (error) {
        console.error('Error resetting password:', error.message);
        this.toastr.error('Error resetting password');
        return;
      }

      this.toastr.success('Password reset email has been sent to the user');
      this.closeResetPasswordModal();
    } catch (error) {
      console.error('Unexpected error resetting password:', error);
      this.toastr.error('Unexpected error resetting password');
    }
  }

  toggleFamilyUser() {
    this.newMember.is_family_user = !this.newMember.is_family_user;

    // If this is a family user, it cannot be a child member
    if (this.newMember.is_family_user) {
      this.isChildMember = false;
    }

    this.cdr.detectChanges();
  }
}
