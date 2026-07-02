import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from './auth.service';
import { Observable, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    const url = state.url;
    const urlID = url.split('/')[4];

    return this.authService.profile$.pipe(
      switchMap((profile) => {
        if (profile) {
          if (profile.role === 'admin') {
            // Admins can access all admin routes
            return of(true);
          } else if (profile.role === 'chairman') {
            // Check if chairman can access the calendar or other allowed routes
            if (url.includes('/admin/calendar')) {
              return of(true);
            }
            // Use the getChairmanInformation method to check access for other routes
            return this.authService
              .getChairmanInformation(profile.id)
              .then(({ divisionID, rulesID }) => {
                return divisionID == urlID || rulesID == urlID;
              });
          } else {
            // Regular users cannot access these routes
            return of(false);
          }
        } else {
          return this.authService
            .getProfile()
            .then((data) => {
              if (data?.role === 'admin') {
                return true; // Allow admin access
              } else if (data?.role === 'chairman') {
                // Check if chairman can access the calendar
                if (url.includes('/admin/calendar')) {
                  return true;
                }
                // Check access using the new method for other routes
                return this.authService
                  .getChairmanInformation(data.id)
                  .then(({ divisionID, rulesID }) => {
                    return divisionID == urlID || rulesID == urlID;
                  });
              } else {
                return false; // Deny access for other users
              }
            })
            .catch(() => {
              return false; // Handle errors
            });
        }
      }),
      catchError(() => of(false)) // Catch any errors and deny access
    );
  }
}
