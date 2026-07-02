import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { provideQuillConfig } from 'ngx-quill';
import { DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes),
    provideAnimations(),
    provideToastr(),
    provideQuillConfig({
      modules: {
        syntax: true,
      },
    }),
    { provide: DateAdapter, useFactory: adapterFactory }, // Provide DateAdapter for angular-calendar
    // CalendarUtils and CalendarA11y should not be manually provided here
  ],
};
