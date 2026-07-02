import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  FormControl,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { combineLatest } from 'rxjs';
import { Toast, ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  registerForm: FormGroup;
  isLoginMode: boolean = true;
  resetEmailPageActive: boolean = false;
  resetPasswordPageActive: boolean = false;
  resetPasswordEmailForm: FormGroup;
  resetPasswordForm: FormGroup;
  user: any; // To hold the user information

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService,
    private supabase: SupabaseService,
    private toastr: ToastrService
  ) {
    // Initialize forms
    this.loginForm = this.createLoginForm();
    this.registerForm = this.createRegisterForm();
    this.resetPasswordEmailForm = this.createResetPasswordEmailForm();
    this.resetPasswordForm = this.createResetPasswordForm();
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['register'] === 'true') {
        this.isLoginMode = false;
      }
      // Handle password recovery type from the URL
      if (params['type'] === 'recovery' && params['token']) {
        this.auth.isResettingPassword = true;
        this.handlePasswordRecovery(params['token']);
      }

      if (
        window.location.href.includes('error=access_denied') ||
        window.location.href.includes('error_code=otp_expired')
      ) {
        this.toastr.error(
          'Email link is invalid or has expired. Please request a new password reset email.'
        );
        this.router.navigate(['/login'], { replaceUrl: true });
        return;
      }
    });

    // Listen for PASSWORD_RECOVERY event from Supabase
    this.supabase.supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        this.resetPasswordPageActive = true;
      }
    });
  }

  private async handlePasswordRecovery(token: string) {
    console.log('Handling password recovery with token:', token);
    try {
      // Clear any existing query parameters to prevent infinite loops
      this.router.navigate([], {
        queryParams: {},
        replaceUrl: true,
      });

      await this.supabase.supabase.auth.exchangeCodeForSession(token);

      // If successful, show reset form
      this.resetPasswordPageActive = true;
    } catch (err) {
      console.error('Unexpected error in password recovery:', err);
      this.resetPasswordPageActive = false; // Ensure reset form is hidden
      this.toastr.error('An unexpected error occurred. Please try again.');
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  private createLoginForm() {
    return new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [
        Validators.minLength(6),
        Validators.required,
      ]),
    });
  }

  private createRegisterForm() {
    return new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      password: new FormControl('', [
        Validators.minLength(6),
        Validators.required,
      ]),
      confirmPassword: new FormControl('', [
        Validators.minLength(6),
        Validators.required,
      ]),
    });
  }

  private createResetPasswordEmailForm() {
    return new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
    });
  }

  private createResetPasswordForm() {
    return new FormGroup({
      password: new FormControl('', [
        Validators.minLength(6),
        Validators.required,
      ]),
      confirmPassword: new FormControl('', [
        Validators.minLength(6),
        Validators.required,
      ]),
    });
  }

  async onUserLogin() {
    const loginInfo = this.loginForm.value;
    try {
      await this.auth.login(loginInfo.email, loginInfo.password);

      combineLatest([this.auth.role$, this.auth.profile$]).subscribe(
        ([role, profile]) => {
          this.routeUserBasedOnRole(role ?? '', profile);
        }
      );
    } catch (error) {
      console.error('Login failed', error);
      const errorMessage =
        (error as Error).message ||
        'An error occurred while logging in. Please try again.';
      this.toastr.error(errorMessage);

      this.router.navigate(['/login']);
    }
  }

  private routeUserBasedOnRole(role: string, profile: any) {
    if (role === 'admin') {
      this.router.navigate(['/secure/admin/users']);
    } else if (profile?.member_type === 'Regular') {
      this.router.navigate(['/']);
    } else {
      this.router.navigate(['/secure/membership']);
    }
  }

  @HostListener('document:keydown.enter', ['$event'])
  handleEnterKey(event: KeyboardEvent) {
    // Prevent default behavior
    event.preventDefault();

    // Get the active element to check which form is being used
    const activeElement = document.activeElement;

    if (this.resetPasswordPageActive) {
      // If on reset password page
      this.onResetPassword();
    } else if (this.resetEmailPageActive) {
      // If on reset email page
      this.onResetPasswordRequest();
    } else if (this.isLoginMode) {
      // If on login page
      if (this.loginForm.valid) {
        this.onUserLogin();
      }
    } else {
      // If on register page
      if (this.registerForm.valid) {
        this.onUserRegister();
      }
    }
  }

  // Register user and insert email/id into profiles table
  async onUserRegister() {
    const registerInfo = this.registerForm.value;

    // Validate passwords match
    if (registerInfo.password !== registerInfo.confirmPassword) {
      this.toastr.error('Passwords do not match. Please try again.');
      return;
    }

    try {
      // Register the user
      const { data: signUpData, error: signUpError } =
        await this.supabase.supabase.auth.signUp({
          email: registerInfo.email,
          password: registerInfo.password,
        });

      if (signUpError) {
        console.error('Error during sign up:', signUpError.message);
        this.toastr.error(
          signUpError.message || 'Registration failed. Please try again.'
        );
        return;
      }

      // Insert user into profiles table
      if (signUpData.user) {
        const { error: insertError } = await this.supabase.supabase
          .from('profiles')
          .insert([{ id: signUpData.user.id, email: signUpData.user.email }]);

        if (insertError) {
          console.error(
            'Error inserting into profiles table:',
            insertError.message
          );
          this.toastr.error(
            insertError.message || 'Registration failed. Please try again.'
          );
          return;
        }

        // Call auth.signInWithPassword() to log the user in
        const { error: signInError } =
          await this.supabase.supabase.auth.signInWithPassword({
            email: registerInfo.email,
            password: registerInfo.password,
          });

        if (signInError) {
          console.error(
            'Error signing in after registration:',
            signInError.message
          );
          this.toastr.error(
            'Registration successful, but login failed. Please log in manually.'
          );
        } else {
          this.toastr.success('Registration successful! Logging you in...');
          // New users have member_type=null; route them straight to the
          // membership form. AuthService.onAuthStateChange doesn't fire a
          // second time after signInWithPassword (already signed in from
          // signUp), so we navigate explicitly.
          localStorage.removeItem('user_profile');
          this.router.navigate(['/secure/membership']);
        }
      }
    } catch (error) {
      console.error('Registration failed:', error);
      this.toastr.error('An error occurred. Please try again.');
    }
  }

  async googleSignIn() {
    try {
      await this.auth.googleSignIn();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Google sign in failed', error);
      const errorMessage =
        (error as Error).message ||
        'An error occurred while signing in with Google.';

      this.toastr.error(errorMessage);
    }
  }

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
  }

  async onResetPasswordRequest() {
    const email = this.resetPasswordEmailForm.get('email')?.value;

    if (!email || !this.resetPasswordEmailForm.get('email')?.valid) {
      this.toastr.error('Please enter a valid email address');
      return;
    }

    const { data, error } =
      await this.supabase.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/login',
      });

    if (error) {
      console.error('Error sending password reset:', error.message);
      this.toastr.error(
        error.message ||
          'Error sending password reset email. Please try again later.'
      );
    } else if (data) {
      this.toastr.success(
        'Password reset email sent. Please check your inbox.'
      );
      this.resetEmailPageActive = false; // Return to login page
    }
  }
  async onResetPassword() {
    const password = this.resetPasswordForm.get('password')?.value;
    const confirmPassword =
      this.resetPasswordForm.get('confirmPassword')?.value;

    if (password !== confirmPassword) {
      this.toastr.error('Passwords do not match. Please try again.');
      return;
    }

    try {
      // Update the user's password
      const { data, error } = await this.supabase.supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error('Error updating password:', error.message);
        this.toastr.error(
          error.message || 'Error updating password. Please try again.'
        );
      } else {
        this.toastr.success(
          'Your password has been updated successfully. Please log in.'
        );
        this.resetPasswordPageActive = false; // Hide reset password form
        this.auth.isResettingPassword = false; // Reset the password flag
        this.router.navigate(['/login']); // Redirect to login page
      }
    } catch (error) {
      console.error('An error occurred:', error);
      const errorMessage =
        (error as Error).message ||
        'An error occurred while resetting the password. Please try again.';
      this.toastr.error(errorMessage);
    }
  }
}
