import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

type FulfillmentStatus = 'fulfilled' | 'already_fulfilled' | 'pending' | 'error';

interface FulfillmentResponse {
  status: FulfillmentStatus;
  message?: string;
  retryable?: boolean;
}

type UiState = 'loading' | 'success' | 'pending' | 'error';

@Component({
  selector: 'app-checkout-complete',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkout-complete.component.html',
  styleUrl: './checkout-complete.component.css',
})
export class CheckoutCompleteComponent implements OnInit {
  state: UiState = 'loading';
  message = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  async ngOnInit() {
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (!sessionId) {
      await this.router.navigate(['/secure/profile']);
      return;
    }

    const accessToken = this.authService.session?.access_token;
    if (!accessToken) {
      this.state = 'error';
      this.message = 'You must be logged in to finalize your membership.';
      return;
    }

    const headers = new HttpHeaders().set(
      'Authorization',
      `Bearer ${accessToken}`,
    );

    try {
      const response = await firstValueFrom(
        this.http.post<FulfillmentResponse>(
          `${environment.supabaseUrl}/functions/v1/fulfill-checkout`,
          { session_id: sessionId },
          { headers },
        ),
      );

      switch (response?.status) {
        case 'fulfilled':
        case 'already_fulfilled':
          this.state = 'success';
          this.message = 'Your membership has been updated.';
          // Refresh the cached profile so /secure/profile reflects the new state.
          localStorage.removeItem('user_profile');
          await this.authService.getProfile();
          break;
        case 'pending':
          this.state = 'pending';
          this.message =
            response.message ||
            "Your payment is still processing. You'll receive a confirmation email when it completes.";
          break;
        case 'error':
        default:
          this.state = 'error';
          this.message =
            response?.message ||
            'Something went wrong finalizing your membership.';
      }
    } catch (err: any) {
      this.state = 'error';
      this.message =
        err?.error?.message ||
        err?.message ||
        'Something went wrong finalizing your membership.';
      console.error('fulfill-checkout error:', err);
    }
  }

  goToProfile() {
    this.router.navigate(['/secure/profile']);
  }
}
