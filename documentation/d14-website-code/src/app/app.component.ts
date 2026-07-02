import {
  Component,
  OnInit,
  HostListener,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { HeaderComponent } from './shared/header/header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  isAdmin: boolean = false;
  isMobile: boolean = false;
  isViewingAsAdmin: boolean = this.getStoredAdminView(); // Initialize from local storage

  title = 'D14';
  lastUrl: string | null = null; // Track the last route

  constructor(
    public auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.checkScreenSize();
    this.onAdminViewToggle();
    this.cdr.detectChanges();
  }

  isLoginRoute(): boolean {
    return this.router.url === '/login';
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.checkScreenSize();
  }

  checkScreenSize() {
    this.isMobile = window.innerWidth <= 1024; // Define "large" in your context
  }

  onAdminViewToggle() {
    this.isViewingAsAdmin = this.getStoredAdminView();
  }

  private getStoredAdminView(): boolean {
    const storedView = localStorage.getItem('isViewingAsAdmin');
    if (storedView === null) {
      if (!this.isAdmin) { // If not admin, default to false
        localStorage.setItem('isViewingAsAdmin', JSON.stringify(false));
        return false;
      }
      localStorage.setItem('isViewingAsAdmin', JSON.stringify(true)); // Admin defaults to true
      return true;
    }
    return JSON.parse(storedView);
  }
}
