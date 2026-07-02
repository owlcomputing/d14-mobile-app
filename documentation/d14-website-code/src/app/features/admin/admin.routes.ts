import { Route } from '@angular/router';

export const AdminRouter: Route[] = [
  {
    path: 'divisions',
    loadComponent: () =>
      import('./division-editing/divisions.component').then(
        (m) => m.DivisionEditor
      ),
  },
  {
    path: 'rules',
    loadComponent: () =>
      import('./rules-editing/rules.component').then((m) => m.RulesComponent),
  },
  {
    path: 'rules-cms/:id',
    loadComponent: () =>
      import('./rules-editing/cms/rules-cms.component').then(
        (m) => m.RulesComponent
      ),
  },
  {
    path: 'cms/:id',
    loadComponent: () =>
      import('./division-editing/cms/cms.component').then(
        (m) => m.CmsComponent
      ),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./user-management/user-management.component').then(
        (m) => m.UserManagementComponent
      ),
  },
  {
    path: 'emails',
    loadComponent: () =>
      import('./emails/emails.component').then((m) => m.EmailsComponent),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./calendar-editor/calendar-editor.component').then(
        (m) => m.CalendarEditorComponent
      ),
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./reporting/reporting.component').then(
        (m) => m.ReportingComponent
      ),
  },
  {
    path: 'contact-management',
    loadComponent: () =>
      import('./contact-management/contact-management.component').then(
        (m) => m.ContactManagementComponent
      ),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('../profile/profile.component').then((m) => m.ProfileComponent),
  },
];
