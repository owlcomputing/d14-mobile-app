import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { SupabaseService } from '../supabase/supabase.service';
import { BehaviorSubject, map } from 'rxjs';
import { Session } from '@supabase/supabase-js';
import { Profile } from '../../features/admin/models/models';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private authSubject: BehaviorSubject<Session | null> = new BehaviorSubject(
    this.getStoredSession()
  ) as BehaviorSubject<Session | null>;
  public auth$ = this.authSubject.asObservable();

  private profileSubject: BehaviorSubject<Profile | null> = new BehaviorSubject(
    this.getStoredProfile()
  ) as BehaviorSubject<Profile | null>;
  public profile$ = this.profileSubject.asObservable();
  public role$ = this.profile$.pipe(map((x) => x?.role ?? null));

  isAdmin: boolean = false;
  isMember: boolean = false;
  private isProfileBeingFetched = false;
  public skipProfileFetch = false;
  private isNewLogin = false;

  isResettingPassword = false;

  constructor(
    private supabaseService: SupabaseService,
    private toastr: ToastrService,
    private router: Router
  ) {
    this.supabaseService.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.isResettingPassword = true;
        console.log('THIS SHOULD BE SKIPPING EVERYTHINGGGGGGG:', event);
        return;
      }

      if (!this.isResettingPassword) {
        this.authSubject.next(session);
        this.storeSession(session);

        if (session && !this.skipProfileFetch) {
          this.getProfile();
        }
      }

      this.skipProfileFetch = false;
    });
  }

  // Store session in local storage
  private storeSession(session: Session | null) {
    if (session) {
      localStorage.setItem('auth_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('auth_session');
    }
  }

  // Retrieve session from local storage
  private getStoredSession(): Session | null {
    const sessionJson = localStorage.getItem('auth_session');
    return sessionJson ? JSON.parse(sessionJson) : null;
  }

  // Store profile in local storage
  private storeProfile(profile: Profile | null) {
    if (profile) {
      localStorage.setItem('user_profile', JSON.stringify(profile));
    } else {
      localStorage.removeItem('user_profile');
    }
  }

  // Retrieve profile from local storage
  private getStoredProfile(): Profile | null {
    const profileJson = localStorage.getItem('user_profile');
    return profileJson ? JSON.parse(profileJson) : null;
  }

  get session() {
    return this.authSubject.value;
  }

  async getProfile(): Promise<Profile | null> {
    if (this.isResettingPassword) {
      return null;
    }
    if (!this.session) throw new Error('Cannot fetch profile without session');
    // Check if profile is already in local storage and not expired
    const storedProfile = this.getStoredProfile();
    if (storedProfile) {
      this.profileSubject.next(storedProfile);
      this.isAdmin = storedProfile?.role === 'admin';
      this.isMember = storedProfile?.member_type === 'Regular';
      return storedProfile;
    }

    const isPasswordRecovery = window.location.href.includes('type=recovery');
    if (isPasswordRecovery) {
      return null;
    }

    if (this.isProfileBeingFetched) return null;
    this.isProfileBeingFetched = true;

    try {
      const { data, error } = await this.supabaseService.supabase
        .from('profiles')
        .select('*')
        .eq('id', this.session.user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          const { user } = this.session;

          if (user && user.app_metadata?.provider === 'google') {
            const { id, email } = user;

            const { error: insertError } = await this.supabaseService.supabase
              .from('profiles')
              .insert([{ id, email }]);

            if (insertError) {
              console.error(
                'Error inserting new profile:',
                insertError.message
              );
              this.toastr.error(
                'Error creating user profile. Please try again.',
                'Error'
              );
              return null;
            }

            const newProfile = { id, email } as Profile;
            this.profileSubject.next(newProfile);
            this.storeProfile(newProfile);
            return newProfile;
          } else {
            console.warn(
              'No profile found, and user is not logged in with Google.'
            );
            return null;
          }
        } else {
          console.error('Error fetching profile:', error.message);
          this.toastr.error(
            'Error fetching user profile. Please try again.',
            'Error'
          );
          return null;
        }
      }

      const profile = data as Profile;
      this.profileSubject.next(profile);
      this.storeProfile(profile);
      this.isAdmin = profile?.role === 'admin';
      this.isMember = profile?.member_type === 'Regular';

      // Redirect if member_type is null
      if (
        profile?.member_type === null &&
        !this.isResettingPassword &&
        !this.isAdmin
      ) {
        this.router.navigate(['/secure/membership']);
        return null;
      }

      return profile;
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
      this.toastr.error(
        'An unexpected error occurred. Please try again.',
        'Error'
      );
      return null;
    } finally {
      this.isProfileBeingFetched = false;
    }
  }

  // Update logout to clear local storage
  async logout() {
    const { error } = await this.supabaseService.supabase.auth.signOut();
    if (error) {
      console.error('Error during logout:', error);
      this.toastr.error('Error logging out. Please try again.', 'Logout Error');
    } else {
      // Clear local storage on logout
      localStorage.removeItem('auth_session');
      localStorage.removeItem('user_profile');
      this.toastr.success('You have been logged out.', 'Goodbye');
    }
  }

  async login(email: string, password: string) {
    this.isNewLogin = true;

    const { data, error } =
      await this.supabaseService.supabase.auth.signInWithPassword({
        email,
        password,
      });
    if (error) {
      console.error('Error logging in:', error.message);
      this.toastr.error(
        'Login failed. Please check your credentials.',
        'Login Error'
      );
      throw error;
    } else {
      this.toastr.success('Login successful!', 'Welcome');
    }
  }

  getAndClearNewLoginFlag() {
    const wasNewLogin = this.isNewLogin;
    this.isNewLogin = false;
    return wasNewLogin;
  }

  async register(
    email: string,
    password: string
  ): Promise<{ user: any; error: any }> {
    this.skipProfileFetch = true; // Set the flag to skip profile fetching after registration

    const { data, error } = await this.supabaseService.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('Error during registration:', error);
      this.toastr.error(`Registration failed: ${error.message}`, 'Error');
      return { user: null, error };
    } else {
      this.toastr.success('Registration successful! Please log in.', 'Welcome');
    }

    return { user: data, error: null };
  }

  async googleSignIn() {
    const { data, error } =
      await this.supabaseService.supabase.auth.signInWithOAuth({
        provider: 'google',
      });
    if (error) {
      console.error('Error logging in with Google:', error.message);
      this.toastr.error('Google sign-in failed. Please try again.', 'Error');
    } else {
      this.toastr.success('Login successful with Google!', 'Welcome');
    }
  }

  async getChairmanInformation(chairmanId: string): Promise<any> {
    const { data: divisionData, error: divisionError } =
      await this.supabaseService.supabase
        .from('divisions')
        .select('id')
        .eq('chairman_id', chairmanId)
        .single();

    if (divisionError) {
      console.error('Error fetching chairman information:', divisionError);
      this.toastr.error(
        'Error fetching chairman information.',
        'Chairman Error'
      );
      return null;
    }

    const divisionID = divisionData?.id;

    if (divisionID) {
      const { data: rulesData, error: rulesError } =
        await this.supabaseService.supabase
          .from('rules')
          .select('id')
          .eq('division_id', divisionID)
          .single();

      if (rulesError) {
        console.error('Error fetching rules information:', rulesError);
        this.toastr.error('Error fetching rules information.', 'Rules Error');
        return null;
      }

      return {
        divisionID,
        rulesID: rulesData?.id,
      };
    }

    return null;
  }
}
