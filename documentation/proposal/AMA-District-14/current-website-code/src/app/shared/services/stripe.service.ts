import { Injectable } from '@angular/core';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StripeService {
  stripePromise: Promise<Stripe | null>;

  constructor() {
    this.stripePromise = loadStripe(environment.stripePublishableKey);
  }

  async redirectToCheckout(sessionId: string) {
    const stripe = await this.stripePromise;
    if (stripe) {
      stripe.redirectToCheckout({ sessionId });
    }
  }
}
