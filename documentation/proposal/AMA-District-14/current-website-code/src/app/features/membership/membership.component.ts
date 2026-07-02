import { Component, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  FormsModule,
  AbstractControl,
  ValidationErrors,
  Form,
} from '@angular/forms';
import {
  FormGroup,
  FormControl,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MultiSelectComponent } from '../../shared/multiselect/multiselect.component';
import { US_STATES } from '../../shared/array/states';
import { CANADIAN_PROVINCES } from '../../shared/array/provinces';
import { FormDataService } from '../../shared/services/form-data.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Profile } from '../admin/models/models';
import { ToastrService } from 'ngx-toastr';
import { MatTooltip } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-membership',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatSelectModule,
    MultiSelectComponent,
    MatTooltipModule,
    FormsModule,
  ],
  templateUrl: './membership.component.html',
  styleUrls: ['./membership.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class MembershipComponent {
  confirmedAMAMembership: boolean = false;
  isMobile: boolean = false;
  membershipSelection: string = '';

  memberType: 'Regular' | 'Charter' | 'Family' | null = null;

  loginForm: FormGroup;
  membershipForm: FormGroup;
  charterMemberForm: FormGroup;
  familyOnly: boolean = false;
  childForms: FormGroup[] = [];
  childFormsRenew: FormGroup[] = [];
  existingChildren: Profile[] = [];
  isAlreadyMember = false;
  isAdmin = false;
  isSubmitting = false;

  disciplines: string[] = [];

  countries = ['United States', 'Canada'];
  usStates = US_STATES;
  canadianProvinces = CANADIAN_PROVINCES;

  private activeTooltip: MatTooltip | null = null; // Track the active tooltip
  private boundScrollHandler = this.onScrollHideTooltip.bind(this); // Store the bound function

  constructor(
    public authService: AuthService,
    private router: Router,
    private formDataService: FormDataService,
    private supabaseService: SupabaseService, // Inject SupabaseService here
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    private breakpointObserver: BreakpointObserver
  ) {
    this.loginForm = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [
        Validators.minLength(6),
        Validators.required,
      ]),
    });

    this.membershipForm = new FormGroup({
      individualName: new FormGroup({
        firstName: new FormControl('', Validators.required),
        middleInitial: new FormControl(''),
        lastName: new FormControl('', Validators.required),
        suffix: new FormControl(''),
      }),
      address: new FormGroup({
        line1: new FormControl('', Validators.required),
        line2: new FormControl(''),
        city: new FormControl('', Validators.required),
        state: new FormControl('', Validators.required),
        zip: new FormControl('', Validators.required),
        country: new FormControl('', Validators.required),
      }),
      email: new FormControl(this.authService.session?.user.email, [
        Validators.required,
        Validators.email,
      ]),
      disciplines: new FormControl(
        [],
        this.familyOnly ? Validators.required : null
      ),
      amaNumber: new FormControl(
        '',
        this.familyOnly ? Validators.required : null
      ),
      birthdate: new FormControl('', [Validators.required, this.dateValidator]),
      cellPhone: new FormControl('', [
        Validators.required,
        this.phoneValidator,
      ]),
      emergencyContactName: new FormControl(''),
      emergencyContactPhone: new FormControl(''),
    });

    this.charterMemberForm = new FormGroup({
      organizationDetails: new FormGroup({
        name: new FormControl('', Validators.required),
        ama_number: new FormControl('', Validators.required),
        address: new FormControl('', Validators.required),
        city: new FormControl('', Validators.required),
        state: new FormControl('', Validators.required),
        zip: new FormControl('', Validators.required),
        country: new FormControl('', Validators.required),
        phone: new FormControl('', [Validators.required, this.phoneValidator]),
        email: new FormControl('', [Validators.required, Validators.email]),
        website: new FormControl(''),
      }),
      primaryContact: new FormGroup({
        firstName: new FormControl('', Validators.required),
        lastName: new FormControl('', Validators.required),
        email: new FormControl('', [Validators.required, Validators.email]),
        phone: new FormControl('', [Validators.required, this.phoneValidator]),
        d14: new FormControl(''),
        address: new FormControl(''),
        city: new FormControl(''),
        state: new FormControl(''),
        zip: new FormControl(''),
        country: new FormControl(''),
      }),
      president: new FormGroup({
        firstName: new FormControl('', Validators.required),
        lastName: new FormControl('', Validators.required),
        email: new FormControl('', [Validators.required, Validators.email]),
        phone: new FormControl('', [Validators.required, this.phoneValidator]),
        d14: new FormControl(''),
        address: new FormControl(''),
        city: new FormControl(''),
        state: new FormControl(''),
        zip: new FormControl(''),
        country: new FormControl(''),
      }),
      referee: new FormGroup({
        firstName: new FormControl(''),
        lastName: new FormControl(''),
        d14: new FormControl(''),
        address: new FormControl(''),
        city: new FormControl(''),
        state: new FormControl(''),
        zip: new FormControl(''),
        country: new FormControl(''),
        email: new FormControl(''),
        phone: new FormControl(''),
      }),
    });

    this.restoreFormData();
  }

  async ngOnInit() {
    // Observe the screen size to set mobile mode if needed
    this.breakpointObserver
      .observe([Breakpoints.Small, Breakpoints.XSmall])
      .subscribe((result) => {
        this.isMobile = result.matches;
      });

    const user = this.authService.session?.user;
    if (user) {
      const { data, error } = await this.supabaseService.supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
      } else {
        this.isAdmin = data.role === 'admin';
      }
    }
    await this.checkForExistingChildren();
    await this.fetchDivisions();
    window.addEventListener('scroll', this.boundScrollHandler);

    this.membershipForm.valueChanges.subscribe(() => {
      this.saveFormData();
    });

    this.charterMemberForm.valueChanges.subscribe(() => {
      this.saveFormData();
    });
    console.log('Confirmed AMA? ', this.confirmedAMAMembership);
  }

  ngOnDestroy() {
    // Remove scroll listener when the component is destroyed
    window.removeEventListener('scroll', this.boundScrollHandler);
  }

  async fetchDivisions() {
    const { data, error } = await this.supabaseService.supabase
      .from('divisions')
      .select('*');

    if (error) {
      console.error('Error fetching divisions:', error);
      return;
    }

    this.disciplines = data.map((division: any) => division.name);
  }

  private saveFormData() {
    try {
      if (this.memberType === 'Charter') {
        // Save charter membership form data
        const charterFormData = this.charterMemberForm.value;
        if (charterFormData) {
          localStorage.setItem(
            'membershipFormData',
            JSON.stringify({
              type: 'charter',
              data: charterFormData,
            })
          );
        }
      } else {
        // Save regular membership form data and any child forms
        const formData = this.membershipForm.value;
        if (formData) {
          const saveData = {
            type: 'regular',
            data: formData,
            children: this.childForms.map((form) => form.value),
          };
          localStorage.setItem('membershipFormData', JSON.stringify(saveData));
        }
      }
    } catch (error) {
      console.error('Error saving form data to local storage:', error);
    }
  }

  private restoreFormData() {
    try {
      const savedFormData = localStorage.getItem('membershipFormData');
      if (!savedFormData) return;

      const parsedData = JSON.parse(savedFormData);

      if (parsedData.type === 'charter') {
        // Restore charter member form data
        Object.keys(parsedData.data).forEach((key) => {
          const control = this.charterMemberForm.get(key);
          if (control) {
            control.setValue(parsedData.data[key], { emitEvent: false });
          }
        });
      } else {
        // Restore regular membership form data
        Object.keys(parsedData.data).forEach((key) => {
          const control = this.membershipForm.get(key);
          if (control) {
            control.setValue(parsedData.data[key], { emitEvent: false });
          }
        });

        // Restore child forms if they exist
        if (parsedData.children && parsedData.children.length > 0) {
          this.childForms = [];
          parsedData.children.forEach((childFormData: any) => {
            const childFormGroup = new FormGroup({
              individualName: new FormGroup({
                firstName: new FormControl(
                  childFormData.individualName?.firstName || '',
                  Validators.required
                ),
                middleInitial: new FormControl(
                  childFormData.individualName?.middleInitial || ''
                ),
                lastName: new FormControl(
                  childFormData.individualName?.lastName || '',
                  Validators.required
                ),
                suffix: new FormControl(
                  childFormData.individualName?.suffix || ''
                ),
              }),
              birthdate: new FormControl(childFormData.birthdate || '', [
                Validators.required,
                this.dateValidator,
              ]),
              amaNumber: new FormControl(
                childFormData.amaNumber || '',
                Validators.required
              ),
              disciplines: new FormControl(
                childFormData.disciplines || [],
                Validators.required
              ),
            });
            this.childForms.push(childFormGroup);
          });
        }
      }
    } catch (error) {
      console.error('Error restoring form data from local storage:', error);
    }
  }

  toggleConfirmAMA() {
    this.confirmedAMAMembership = !this.confirmedAMAMembership;
    this.cdr.detectChanges();
  }

  checkMembershipSelection() {
    if (this.membershipSelection === 'familyOnly') {
      this.familyOnly = true;
      if (this.childForms.length < 1) {
        this.addChildFormGroup();
      }
    } else if (this.membershipSelection === 'selfAndFamily') {
      this.familyOnly = false;
      if (this.childForms.length < 1) {
        this.addChildFormGroup();
      }
    } else {
      this.familyOnly = false;
      this.childForms = [];
    }
    this.cdr.detectChanges();
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

  private onScrollHideTooltip() {
    if (this.activeTooltip) {
      this.activeTooltip.hide();
      this.activeTooltip = null;
    }
  }

  onBirthdateInput(event: Event, member: string, childNum: number = 0): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/[^0-9]/g, ''); // Only keep numeric characters

    if (value.length > 8) {
      value = value.slice(0, 8);
    }

    if (
      value.length === 2 &&
      !(event as InputEvent).inputType.includes('deleteContentBackward')
    ) {
      value = value + '/';
    } else if (value.length > 2 && value.length <= 4) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    } else if (
      value.length === 4 &&
      !(event as InputEvent).inputType.includes('deleteContentBackward')
    ) {
      value = value.slice(0, 2) + '/' + value.slice(2) + '/';
    } else if (value.length > 4) {
      value =
        value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4);
    }

    input.value = value;
    if (member === 'member') {
      this.membershipForm
        .get('birthdate')
        ?.setValue(value, { emitEvent: false });
    } else if (member === 'charter') {
      this.charterMemberForm
        .get('primaryContact.birthdate')
        ?.setValue(value, { emitEvent: false });
    } else {
      this.childForms[childNum]
        .get('birthdate')
        ?.setValue(value, { emitEvent: false });
    }
  }

  //add phone number validation function with accepted formats of (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx, xxx xxx xxxx (thank you copilot)
  phoneValidator(control: AbstractControl): ValidationErrors | null {
    const phoneRegex = /^(\(\d{3}\)|\d{3})[\s\-\.]?\d{3}[\s\-\.]?\d{4}$/;
    const value = control.value;

    if (!phoneRegex.test(value)) {
      return {
        invalidFormat:
          'Phone number must be in (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx, xxx xxx xxxx format',
      };
    }

    return null;
  }

  setMembershipType(type: string) {
    switch (type) {
      case 'Regular':
        this.memberType = 'Regular';
        break;
      case 'Charter':
        this.memberType = 'Charter';
        break;
      case 'Family':
        this.memberType = 'Family';
        break;
      default:
        this.memberType = null;
        break;
    }
  }

  onStateChange(event: Event, form: FormGroup, person?: string) {
    const state = (event.target as HTMLSelectElement).value;
    const country = this.usStates.includes(state) ? 'United States' : 'Canada';

    if (form === this.membershipForm) {
      this.membershipForm.get('address.country')?.setValue(country);
      return;
    }

    // Charter member form cases
    const formPath = person ? `${person}.` : 'organizationDetails.';

    this.charterMemberForm.get(`${formPath}country`)?.setValue(country);
  }

  async submitForm() {
    if (this.memberType === null) {
      this.toastr.error('Please select a membership type to continue.');
      return;
    }

    if (this.isSubmitting) return;
    this.isSubmitting = true;

    if (this.memberType === 'Charter') {
      if (this.charterMemberForm.invalid) {
        this.markFormGroupTouched(this.charterMemberForm);
        this.logFormErrors(this.charterMemberForm);
        const emptyFields = this.getEmptyFields(this.charterMemberForm);
        this.toastr.error(
          `Please fill out all required fields: ${emptyFields.join(', ')}`
        );
        this.isSubmitting = false;
        return;
      }

      if (this.charterMemberForm.valid) {
        const formData = this.charterMemberForm.value;

        // First, create the organization
        const userId = this.authService.session?.user.id ?? null;
        const organizationData = {
          ...formData.organizationDetails,
          primary_contact_name:
            formData.primaryContact.firstName +
            ' ' +
            formData.primaryContact.lastName,
          primary_contact_email: formData.primaryContact.email,
          primary_contact_phone: formData.primaryContact.phone,
          primary_contact_d14: formData.primaryContact.d14,
          primary_contact_address: formData.primaryContact.address,
          primary_contact_city: formData.primaryContact.city,
          primary_contact_state: formData.primaryContact.state,
          primary_contact_zip: formData.primaryContact.zip,
          primary_contact_country: formData.primaryContact.country,
          president_name:
            formData.president.firstName + ' ' + formData.president.lastName,
          president_email: formData.president.email,
          president_phone: formData.president.phone,
          president_d14: formData.president.d14,
          president_address: formData.president.address,
          president_city: formData.president.city,
          president_state: formData.president.state,
          president_zip: formData.president.zip,
          president_country: formData.president.country,
          referee_name:
            formData.referee.firstName + ' ' + formData.referee.lastName,
          referee_email: formData.referee.email,
          referee_phone: formData.referee.phone,
          referee_d14: formData.referee.d14,
          referee_address: formData.referee.address,
          referee_city: formData.referee.city,
          referee_state: formData.referee.state,
          referee_zip: formData.referee.zip,
          referee_country: formData.referee.country,
          organization_user_id: userId,
        };

        // create a virtual charter member profile using the club information
        const virtualMemberData = {
          user_id: userId,
          first_name: organizationData.name,
          last_name: 'MEMBERSHIP',
          address_line1: organizationData.address,
          city: organizationData.city,
          state: organizationData.state,
          zip: organizationData.zip,
          country: organizationData.country,
          email: organizationData.email,
          cell_phone: organizationData.phone,
          member_type: 'Charter',
          organization_id: null as number | null,
        };

        try {
          // Create organization
          const { data: orgData, error: orgError } =
            await this.supabaseService.supabase
              .from('organizations')
              .insert(organizationData)
              .select();

          if (orgError) throw orgError;

          virtualMemberData.organization_id = orgData[0].id;

          await this.supabaseService.cacheMembershipData(virtualMemberData);
          this.formDataService.setFormData(virtualMemberData);

          this.router.navigate(['/secure/checkout']);
        } catch (error) {
          console.error('Error creating charter membership:', error);
          this.toastr.error('Error creating charter membership');
          this.isSubmitting = false;
        }
      }
    } else if (this.memberType === 'Regular') {
      if (this.familyOnly) {
        if (this.childForms.length < 1 && this.existingChildren.length < 1) {
          this.toastr.error(
            'Add a family member or uncheck the "Family Only" box to continue.'
          );
          this.isSubmitting = false;
          return;
        }
      }

      if (this.membershipForm.invalid) {
        // Check for any invalid fields and display a single error message
        this.markFormGroupTouched(this.membershipForm);
        this.logFormErrors(this.membershipForm);
        const emptyFields = this.getEmptyFields(this.membershipForm);
        this.toastr.error(
          `Please fill out all required fields: ${emptyFields.join(', ')}`
        );
        this.isSubmitting = false;
        return;
      }

      if (this.membershipForm.valid) {
        const formData = this.membershipForm.value;
        localStorage.removeItem('membershipFormData');
        localStorage.removeItem('membershipChildFormsData');
        if (formData.birthdate.includes('-')) {
          const [year, month, day] = formData.birthdate.split('-').map(Number);
          formData.birthdate = `${month}/${day}/${year}`;
        }

        const flattenedFormData = {
          member_type: this.familyOnly ? 'Family' : 'Regular',
          membership_option: formData.membershipOption,
          first_name: formData.individualName.firstName,
          middle_initial: formData.individualName.middleInitial,
          last_name: formData.individualName.lastName,
          suffix: formData.individualName.suffix,
          address_line1: formData.address.line1,
          address_line2: formData.address.line2,
          city: formData.address.city,
          state: formData.address.state,
          zip: formData.address.zip,
          country: formData.address.country,
          email: formData.email,
          disciplines: formData.disciplines,
          ama_number: formData.amaNumber,
          birthdate: formData.birthdate,
          cell_phone: formData.cellPhone,
          emergency_contact_name: formData.emergencyContactName,
          emergency_contact_phone: formData.emergencyContactPhone,
          signature: formData.signature,
          created_at: formData.date,
        };

        const allMembers = [flattenedFormData];

        // handle all NEW child forms
        for (const childForm of this.childForms) {
          const childFormData = childForm.value;

          if (childFormData.birthdate.includes('-')) {
            const [year, month, day] = childFormData.birthdate
              .split('-')
              .map(Number);
            childFormData.birthdate = `${month}/${day}/${year}`;
          }

          const childMember = {
            parent_id: this.authService.session?.user.id,
            member_type: 'Regular',
            membership_option: formData.membershipOption,
            first_name: childFormData.individualName.firstName,
            middle_initial: childFormData.individualName.middleInitial,
            last_name: childFormData.individualName.lastName,
            suffix: childFormData.individualName.suffix,
            address_line1: formData.address.line1,
            address_line2: formData.address.line2,
            city: formData.address.city,
            state: formData.address.state,
            zip: formData.address.zip,
            country: formData.address.country,
            email: formData.email,
            birthdate: childFormData.birthdate,
            ama_number: childFormData.amaNumber,
            disciplines: childFormData.disciplines,
            cell_phone: formData.cellPhone,
            emergency_contact_name:
              formData.individualName.first_name +
              ' ' +
              formData.individualName.last_name,
            emergency_contact_phone: formData.cellPhone,
            signature: formData.signature,
          };

          try {
            const requestData: any = {
              ...childMember,
              password: 'password',
              from: 'membership',
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
              console.error('Error creating new child user:', result.error);
              this.isSubmitting = false;
              return;
            }
          } catch (error) {
            console.error('Unexpected error:', error);
          }
        }

        try {
          const userId = this.authService.session?.user.id; // Ensure the user is logged in and get the userId
          if (userId) {
            for (const member of allMembers) {
              const cacheData = { ...member, user_id: userId };
              // check if user is already in the temp table
              try {
                const { data, error } = await this.supabaseService.supabase
                  .from('temp_membership_form_data')
                  .select('*')
                  .eq('user_id', userId);

                if (error) {
                  console.error(
                    'Error fetching existing membership data:',
                    error
                  );
                  this.isSubmitting = false;
                  return;
                }

                if (data) {
                  console.log('Existing temp membership data:', data);
                  // delete the existing record from the temp table
                  const { error: deleteError } =
                    await this.supabaseService.supabase
                      .from('temp_membership_form_data')
                      .delete()
                      .eq('user_id', userId);

                  if (deleteError) {
                    console.error(
                      'Error deleting existing membership data:',
                      deleteError
                    );
                    this.isSubmitting = false;
                    return;
                  }
                }
              } catch (error) {
                console.error('Unexpected error:', error);
                return;
              }

              await this.supabaseService.cacheMembershipData(cacheData); // Save each member to Supabase
            }

            this.formDataService.setFormData(flattenedFormData); // Optionally, store locally
            this.router.navigate(['/secure/checkout']); // Navigate to checkout page
          } else {
            console.error('User not logged in. Cannot cache data.');
          }
        } catch (error) {
          console.error('Error caching membership data:', error);
          this.isSubmitting = false;
        }
      } else {
        this.markFormGroupTouched(this.membershipForm);
        this.logFormErrors(this.membershipForm);
        this.isSubmitting = false;
      }
    }
  }

  onFamilyOnlyChange() {
    this.familyOnly = !this.familyOnly;
    if (this.familyOnly) {
      this.addChildFormGroup();
    } else {
      this.removeChildFormGroup(0);
    }
    this.cdr.detectChanges();
  }

  dateValidator(control: AbstractControl): ValidationErrors | null {
    const dateRegexMMDDYYYY = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
    const dateRegexYYYYMMDD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    const value = control.value;

    if (!dateRegexMMDDYYYY.test(value) && !dateRegexYYYYMMDD.test(value)) {
      return {
        invalidFormat: 'Date must be in MM/DD/YYYY or YYYY-MM-DD format',
      };
    }

    let date: Date;
    if (dateRegexMMDDYYYY.test(value)) {
      const [month, day, year] = value.split('/').map(Number);
      date = new Date(year, month - 1, day);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return { invalidDate: 'Date is not valid' };
      }
    } else if (dateRegexYYYYMMDD.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      date = new Date(year, month - 1, day);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return { invalidDate: 'Date is not valid' };
      }
    }

    return null;
  }

  async checkForExistingChildren() {
    this.existingChildren = [];
    const user = this.authService.session?.user;
    if (user) {
      try {
        const { data, error } = await this.supabaseService.supabase
          .from('profiles')
          .select('*')
          .eq('parent_id', user.id);

        const profiles = data as Profile[];
        if (profiles.length > 0) {
          this.existingChildren = profiles;
          this.cdr.detectChanges();
        }
      } catch (error) {
        console.error('Error fetching child data:', error);
      }
    }
  }
  async removeExistingChild(id: string) {
    try {
      const response = await fetch(
        `${environment.supabaseUrl}/functions/v1/deleteUser`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile_id: id,
          }),
        }
      );

      if (response.status === 204 || response.ok) {
        await this.checkForExistingChildren();
      } else {
        const result = await response.json();
        console.error(result.error || 'Error deleting user');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
    this.cdr.detectChanges();
  }
  // Helper method to get empty required fields
  private getEmptyFields(formGroup: FormGroup, path: string[] = []): string[] {
    let emptyFields: string[] = [];
    Object.keys(formGroup.controls).forEach((key) => {
      const control = formGroup.get(key);
      const controlPath = [...path, key];

      if (control instanceof FormControl) {
        if (control.invalid && control.errors?.['required']) {
          emptyFields.push(controlPath.join(' -> '));
        }
      } else if (control instanceof FormGroup) {
        emptyFields = emptyFields.concat(
          this.getEmptyFields(control, controlPath)
        );
      }
    });
    return emptyFields;
  }

  // Helper method to mark all controls as touched
  private markFormGroupTouched(formGroup: FormGroup) {
    (Object as any)
      .values(formGroup.controls)
      .forEach((control: FormGroup<any>) => {
        control.markAsTouched();

        if (control.controls) {
          this.markFormGroupTouched(control);
        }
      });
  }

  // Helper method to log form errors
  private logFormErrors(formGroup: FormGroup, path: string[] = []) {
    Object.keys(formGroup.controls).forEach((key) => {
      const control = formGroup.get(key);
      const controlPath = [...path, key];

      if (control instanceof FormControl) {
        if (control.invalid) {
          console.error(
            `Invalid control at ${controlPath.join(' -> ')}:`,
            control.errors
          );
        }
      } else if (control instanceof FormGroup) {
        this.logFormErrors(control, controlPath);
      }
    });
  }

  // Method to add a child form group
  addChildFormGroup(): void {
    const childFormGroup = new FormGroup({
      individualName: new FormGroup({
        firstName: new FormControl('', Validators.required),
        middleInitial: new FormControl(''),
        lastName: new FormControl('', Validators.required),
        suffix: new FormControl(''),
      }),
      birthdate: new FormControl('', [Validators.required, this.dateValidator]),
      amaNumber: new FormControl('', Validators.required),
      disciplines: new FormControl([], Validators.required),
    });

    this.childForms.push(childFormGroup);
    this.cdr.detectChanges();
  }

  // Method to remove a child form group
  removeChildFormGroup(index: number): void {
    this.childForms.splice(index, 1);
    this.cdr.detectChanges();
  }

  async login() {
    const loginInfo = this.loginForm.value;
    try {
      await this.authService.login(loginInfo.email, loginInfo.password);
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Login failed', error);
    }
  }

  async googleSignIn() {
    try {
      await this.authService.googleSignIn();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Google sign in failed', error);
    }
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }
}

interface MembershipData {
  id: number;
  profile_id: string;
  date_created: string | null;
  expiration: string;
}
