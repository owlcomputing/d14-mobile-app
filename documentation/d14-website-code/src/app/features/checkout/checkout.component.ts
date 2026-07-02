import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FormDataService } from '../../shared/services/form-data.service';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { firstValueFrom } from 'rxjs';
import { Profile } from '../admin/models/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  membershipFormData: any;
  stripe: Stripe | null = null;
  clientSecret = '';
  checkout: any = null;
  recurring = false;
  isCheckoutInitialized = false;
  isMember = false;
  hasPendingRenewals = false;
  user: Profile | null = null;
  postSignupFamilyMember: Profile | null = null;

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private formDataService: FormDataService,
    private http: HttpClient,
    private authService: AuthService,
    private supabaseService: SupabaseService
  ) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.resetCheckout();
    });
  }

  async ngOnInit() {
    await this.initializeStripe();
    await this.checkMembershipStatus();
    this.membershipFormData = this.formDataService.getFormData();
    await this.initializeEmbeddedCheckout();
  }

  private getReturnUrl(): string {
    // `{CHECKOUT_SESSION_ID}` is a literal placeholder Stripe substitutes with
    // the real session id at session-creation time (embedded-checkout pattern).
    return `${window.location.origin}/secure/checkout/complete?session_id={CHECKOUT_SESSION_ID}`;
  }

  private async initializeStripe() {
    this.stripe = await loadStripe(environment.stripePublishableKey);
  }

  private async checkMembershipStatus() {
    const userId = this.authService.session?.user.id;
    if (!userId) return console.error('User ID not found.');

    const { data: membershipData, error: membershipError } =
      await this.supabaseService.supabase
        .from('memberships')
        .select('*')
        .eq('profile_id', userId);

    if (membershipError) {
      console.error('Error fetching membership data:', membershipError);
      return;
    }

    this.isMember = Boolean(membershipData.length > 0);
    await this.getProfile();

    this.hasPendingRenewals = await this.checkPendingRenewals(userId);
    if (this.hasPendingRenewals) {
      this.isMember = true;
      this.postSignupFamilyMember = null;
      return;
    }

    if (this.isMember) {
      await this.checkPostSignupFamilyMembers(userId);
    } else {
      await this.checkChildProfilesMembership(userId);
      await this.checkPostSignupFamilyMembers(userId);
    }

    // Always check if the parent is becoming a full member.
    // This ensures we don't misclassify the flow as a renewal when
    // the parent has temp data to activate a full membership.
    await this.checkChangeToFullMembership(userId);
  }

  private async checkPendingRenewals(userId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService.supabase
      .from('renewals')
      .select('id')
      .or(`id.eq.${userId},parent_id.eq.${userId}`);

    if (error) {
      console.error('Error checking pending renewals:', error);
      return false;
    }

    return Boolean(data && data.length > 0);
  }

  private async checkChangeToFullMembership(userId: string) {
    const { data: profileData } = await this.supabaseService.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId);

    if (profileData && profileData[0].member_type == null) {
      return;
    }

    const { data: tempMembershipData } = await this.supabaseService.supabase
      .from('temp_membership_form_data')
      .select('*')
      .eq('user_id', userId);

    if (
      tempMembershipData?.length &&
      tempMembershipData[0].member_type === 'Regular'
    ) {
      this.postSignupFamilyMember = tempMembershipData[0] as unknown as Profile;
    }
  }

  private async checkPostSignupFamilyMembers(userId: string) {
    const { data: profileData } = await this.supabaseService.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId);

    if (profileData && profileData[0].member_type == null) {
      return;
    }

    const { data: tempMembershipData } = await this.supabaseService.supabase
      .from('temp_membership_form_data')
      .select('*')
      .eq('parent_id', userId);

    if (tempMembershipData?.length) {
      this.postSignupFamilyMember = tempMembershipData[0] as unknown as Profile;
    }
  }

  private async checkChildProfilesMembership(userId: string) {
    const { data: childProfiles } = await this.supabaseService.supabase
      .from('profiles')
      .select('id')
      .eq('parent_id', userId);

    if (childProfiles?.length && this.user?.member_type === 'Family') {
      const childProfileIds = childProfiles.map((profile) => profile.id);
      const { data: memberships } = await this.supabaseService.supabase
        .from('memberships')
        .select('*')
        .in('profile_id', childProfileIds);

      this.isMember = Boolean(memberships && memberships.length > 0);
    }
  }

  private async getProfile() {
    const userId = this.authService.session?.user.id;
    if (!userId) return console.error('User ID not found.');

    const { data: profile } = await this.supabaseService.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      this.user = profile as Profile;
    } else {
      console.error('Profile not found.');
    }
  }

  private async initializeEmbeddedCheckout(reinitialize = false) {
    localStorage.removeItem('user_profile');
    if (!this.stripe || (this.isCheckoutInitialized && !reinitialize)) return;

    if (this.checkout) {
      this.checkout.destroy();
      this.checkout = null;
    }

    const clientSecret = await this.fetchClientSecret();
    if (clientSecret) {
      this.checkout = await this.stripe.initEmbeddedCheckout({ clientSecret });
      this.checkout.mount('#checkout');
      this.isCheckoutInitialized = true;
    } else {
      console.error('Failed to initialize checkout: No client secret received');
    }
  }

  private async fetchClientSecret(): Promise<string> {
    const priceId = this.getPriceId();
    const userId = this.authService.session?.user.id;
    const returnUrl = this.getReturnUrl();

    if (!priceId || !userId) {
      console.error('Missing price ID or user ID.');
      return '';
    }

    if (
      this.isMember &&
      !this.hasPendingRenewals &&
      !this.postSignupFamilyMember
    ) {
      console.error('No pending checkout action found for existing member.');
      return '';
    }

    console.log(
      priceId,
      'recurring:' + this.recurring,
      'user_id:' + userId,
      'renewal:' + this.hasPendingRenewals,
      'postSignupFamilyMember:' + (this.postSignupFamilyMember ? true : false),
      'familyOnly:' + (this.membershipFormData?.member_type === 'Family')
    );

    const headers = new HttpHeaders().set(
      'Authorization',
      'Bearer your_jwt_token'
    );
    // For new signups the membership-form email is the right prefill; for
    // existing-member renewals / family-adds the auth-side profile email is.
    const customerEmail =
      this.membershipFormData?.email ||
      this.postSignupFamilyMember?.email ||
      this.user?.email ||
      this.authService.session?.user.email ||
      '';

    try {
      const response = await firstValueFrom(
        this.http.post<{ id: string }>(
          `${environment.supabaseUrl}/functions/v1/create-checkout-session`,
          {
            priceId,
            recurring: this.recurring,
            user_id: userId,
            renewal: this.hasPendingRenewals,
            postSignupFamilyMember: this.postSignupFamilyMember ? true : false,
            familyOnly: this.membershipFormData?.member_type === 'Family',
            returnUrl,
            customerEmail,
          },
          { headers }
        )
      );
      return response?.id || '';
    } catch (error) {
      console.error('Error fetching client secret:', error);
      return '';
    }
  }

  private getPriceId(): string {
    if (
      this.membershipFormData?.member_type === 'Charter' ||
      this.user?.member_type === 'Charter'
    ) {
      return environment.stripePriceIdCharter;
    }
    return environment.stripePriceIdDefault; // Default price ID
  }

  resetCheckout() {
    this.isCheckoutInitialized = false;
  }

  ngOnDestroy() {
    this.checkout?.destroy();
    this.checkout = null;
    this.isCheckoutInitialized = false;
    localStorage.removeItem('user_profile');
  }
}
