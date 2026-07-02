import { Routes } from '@angular/router';
import { AdminGuard } from './core/auth/admin-guard';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent),
    },
    {
        path: '',
        pathMatch:'full',
        loadComponent: () => import("./features/landing/landing.component").then(m => m.LandingComponent),
    },
    {
        path: 'secure',
        loadComponent: () => import('./shared/layout/layout.component').then(m => m.LayoutComponent),
        loadChildren: () => [
            {
                path: 'home',
                loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
            },
            {
                path: 'calendar',
                loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent),
            },
            {
                path: 'divisions/:id',
                loadComponent: () => import('./features/divisions/divisions.component').then(m => m.DivisionsComponent),
            },
            {
                path: 'event/:id',
                loadComponent: () => import('./features/event/event.component').then(m => m.EventComponent),
            },
            {
                path: 'rules/:id',
                loadComponent: () => import('./features/rules/rules.component').then(m => m.RulesComponent),
            },
            {
                path: 'membership',
                loadComponent: () => import('./features/membership/membership.component').then(m => m.MembershipComponent),
            },
            {
                path: 'checkout',
                loadComponent: () => import('./features/checkout/checkout.component').then(m => m.CheckoutComponent),
            },
            {
                path: 'checkout/complete',
                loadComponent: () => import('./features/checkout/checkout-complete.component').then(m => m.CheckoutCompleteComponent),
            },
            {
                path: 'magazine',
                loadComponent: () => import('./features/magazine/magazine.component').then(m => m.MagazineComponent),
            },
            {
                path: 'contact',
                loadComponent: () => import('./features/contact/contact.component').then(m => m.ContactComponent),
            },
            {
                path: 'admin',
                loadChildren: () => import("./features/admin/admin.routes").then(m => m.AdminRouter),
                canActivate: [AdminGuard]
            },
            {
                path: 'profile',
                loadComponent: () => import("./features/profile/profile.component").then(m => m.ProfileComponent),
            },
            
            {
                path: '**',
                pathMatch: 'full',
                redirectTo: 'landing'
            }
        ]
    },
    
];
