import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  EventEmitter,
  Output,
  HostListener,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { SupabaseService } from '../../core/supabase/supabase.service';
import {
  faMotorcycle,
  faBook,
  faUser,
  faCalendar,
  faMailBulk,
  faEye,
  faChartBar,
  faSignInAlt,
  faSignOutAlt,
  faHome,
  faRankingStar,
  faEnvelope,
  faUsers,
  faAddressBook,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule],
  styleUrls: ['./header.component.scss'],
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit, OnDestroy {
  isDivisionMobileDropdownOpen: boolean = false;
  isRulesMobileDropdownOpen: boolean = false;
  isDivisionDropdownOpen: boolean = false;
  isRulesDropdownOpen: boolean = false;
  isChairmanDropdownOpen: boolean = false;
  isChairmanMobileDropdownOpen: boolean = false;
  chairmanRoutes: NavRoute[] = [];

  isAdmin: boolean = false;
  isMember: boolean = false;
  isChairman: boolean = false;
  chairmanDivisionId: number | null = null;
  chairmanRulesId: number | null = null;
  isViewingAsAdmin: boolean | null = this.getStoredAdminView();
  isSidebarOpen: boolean = false;
  isProfileDropdownOpen: boolean = false; // Add this line
  divisions: Division[] = [];
  rules: any[] = [];

  faMotorcycle = faMotorcycle;
  faBook = faBook;
  faUser = faUser;
  faCalendar = faCalendar;
  faMailBulk = faMailBulk;
  faChartBar = faChartBar;
  faSignInAlt = faSignInAlt;
  faSignOutAlt = faSignOutAlt;
  faExchangeAlt = faEye;
  faHome = faHome;

  showHeader: boolean = true;
  routes$: Observable<NavRoute[]>;
  private routesSubject = new BehaviorSubject<NavRoute[]>([]);
  private subscriptions: Subscription = new Subscription();
  @Output() adminViewToggle = new EventEmitter<boolean | null>();
  document: any;

  constructor(
    public authService: AuthService,
    private supabase: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.showHeader = !['/login?register=true'].includes(
          event.urlAfterRedirects
        );
      }
    });
    this.routes$ = this.routesSubject.asObservable();
  }

  async ngOnInit() {
    this.authService.role$.subscribe((role) => {
      this.isAdmin = role === 'admin';
      this.isChairman = role === 'chairman';
      if (this.isAdmin && this.authService.getAndClearNewLoginFlag()) {
        this.isViewingAsAdmin = true;
        this.saveAdminView(true);
        this.adminViewToggle.emit(true);
      }
      this.updateRoutes(role ?? 'user', !!this.authService.auth$);
      this.cdr.detectChanges();
    });

    await this.fetchDivisions();
    await this.fetchRules();
    await this.checkMembership();
    this.setupRoutes();
    this.setupSubscriptions();

    // Use router.navigateByUrl instead of navigate
    if (this.isAdmin && this.isViewingAsAdmin && this.router.url === '/') {
      this.router.navigateByUrl('/secure/admin/users');
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  async fetchDivisions() {
    const { data, error } = await this.supabase.supabase
      .from('divisions')
      .select('id, name, chairman_id');
    if (error) console.error(error);
    // sort the divisions by name
    if (data) {
      data.sort((a: Division, b: Division) => {
        if (a.name && b.name) {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
    }
    this.divisions = data as Division[];

    if (data) {
      // Check if the current user is a chairman
      const user = this.authService.session?.user;
      if (user) {
        const chairmanDivision = data.find(
          (division) => division.chairman_id === user.id
        );
        if (chairmanDivision) {
          this.isChairman = true;
          this.chairmanDivisionId = chairmanDivision.id;
        }
      }
    }
  }

  async fetchRules() {
    const { data, error } = await this.supabase.supabase
      .from('rules')
      .select('*');
    if (error) console.error(error);
    if (data) {
      data.sort((a: Rule, b: Rule) => {
        if (a.name && b.name) {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
    }
    this.rules = data || [];

    if (this.chairmanDivisionId) {
      const chairmanRules = this.rules.find(
        (rule) => rule.division_id === this.chairmanDivisionId
      );
      if (chairmanRules) {
        this.chairmanRulesId = chairmanRules.id;
      }
    }
  }

  toggleDropdown(
    type: 'division' | 'rules' | 'chairman',
    isMobile: boolean = false
  ) {
    if (isMobile) {
      this.isDivisionMobileDropdownOpen =
        type === 'division' ? !this.isDivisionMobileDropdownOpen : false;
      this.isRulesMobileDropdownOpen =
        type === 'rules' ? !this.isRulesMobileDropdownOpen : false;
      this.isChairmanMobileDropdownOpen =
        type === 'chairman' ? !this.isChairmanMobileDropdownOpen : false;
    } else {
      this.isDivisionDropdownOpen =
        type === 'division' ? !this.isDivisionDropdownOpen : false;
      this.isRulesDropdownOpen =
        type === 'rules' ? !this.isRulesDropdownOpen : false;
      this.isChairmanDropdownOpen =
        type === 'chairman' ? !this.isChairmanDropdownOpen : false;
    }
    this.cdr.detectChanges();
  }

  @HostListener('mouseenter', ['$event'])
  onMouseEnter() {
    this.isSidebarOpen = true;
    this.cdr.detectChanges();
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave() {
    this.isSidebarOpen = false;
    this.cdr.detectChanges();
  }

  async logout() {
    await this.authService.logout();
    this.isAdmin = false;
    this.saveAdminView(null);
    this.adminViewToggle.emit(this.isViewingAsAdmin);
    this.updateRoutes();
    this.router.navigate(['/']);
  }

  private setupSubscriptions() {
    this.subscriptions.add(
      this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe(() => {
          this.isDivisionDropdownOpen = false;
          this.isRulesDropdownOpen = false;
          this.cdr.detectChanges();
        })
    );

    this.subscriptions.add(
      combineLatest([this.authService.auth$, this.authService.role$])
        .pipe(
          tap(([authState, role]) =>
            this.updateRoutes(role ?? 'user', authState !== null)
          )
        )
        .subscribe()
    );
  }

  handleClick(subrouteRouterLink: string, itemRouterLink: string): void {
    // Handle external division/rules links
    const externalLinks = {
      'divisions/17': {
        url: 'http://www.michiganvintagemotocross.com/',
        internalRoute: '/secure/divisions/17',
      },
      'rules/17': {
        url: 'http://www.michiganvintagemotocross.com/2024-rules',
        internalRoute: '/secure/rules/17',
      },
      'divisions/22': {
        url: 'https://michigansprintenduro.com/',
        internalRoute: '/secure/divisions/22',
      },
      'rules/22': {
        url: 'https://michigansprintenduro.com/rules/',
        internalRoute: '/secure/rules/22',
      },
      'divisions/19': {
        url: 'https://amadistrict14hillclimbriders.godaddysites.com/',
        internalRoute: '/secure/divisions/19',
      },
      'rules/19': {
        url: 'https://amadistrict14hillclimbriders.godaddysites.com/rules',
        internalRoute: '/secure/rules/19',
      },
    };

    // Check if route matches any external links
    for (const [route, config] of Object.entries(externalLinks)) {
      if (subrouteRouterLink.endsWith(route)) {
        window.open(config.url, '_blank');
        if (config.internalRoute) {
          this.router.navigate([config.internalRoute]);
        }
        return;
      }
    }

    // Handle dropdown toggles
    if (itemRouterLink === '/secure/divisions') {
      this.toggleDropdown('division');
    } else {
      this.toggleDropdown('rules');
    }
  }

  private setupRoutes() {
    this.updateRoutes();
  }

  // Method to save admin view to local storage
  private saveAdminView(isAdminView: boolean | null) {
    localStorage.setItem('isViewingAsAdmin', JSON.stringify(isAdminView));
  }

  // Method to retrieve admin view from local storage
  private getStoredAdminView(): boolean {
    const storedView = localStorage.getItem('isViewingAsAdmin');
    if (storedView === null) {
      if (!this.isAdmin) {
        // If not admin, default to false
        localStorage.setItem('isViewingAsAdmin', JSON.stringify(false));
        return false;
      }
      localStorage.setItem('isViewingAsAdmin', JSON.stringify(true)); // Admin defaults to true
      return true;
    }
    return JSON.parse(storedView);
  }

  toggleAdminView() {
    this.isViewingAsAdmin = !this.isViewingAsAdmin;

    // Save to local storage instead of emitting
    this.saveAdminView(this.isViewingAsAdmin);

    this.updateRoutes(
      this.isAdmin ? 'admin' : 'user',
      !!this.authService.auth$
    );
    // emit view toggle
    this.adminViewToggle.emit(this.isViewingAsAdmin);
    this.cdr.detectChanges();
  }

  async checkMembership() {
    try {
      const user = this.authService.session?.user;
      if (user) {
        const { data: profileData, error: profileError } =
          await this.supabase.supabase
            .from('profiles')
            .select('member_type')
            .eq('id', user.id)
            .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          return;
        }

        this.isMember = profileData?.member_type ? true : false;
        this.cdr.detectChanges();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  }

  closeDrawer() {
    const drawerToggle = document.getElementById(
      'mobile-menu'
    ) as HTMLInputElement;
    if (drawerToggle) {
      drawerToggle.checked = false;
    }
  }

  private updateRoutes(
    role: string = 'user',
    isAuthenticated: boolean = false
  ) {
    const routes = this.getRoutes(role, isAuthenticated);
    this.routesSubject.next(routes);
    this.cdr.detectChanges();
  }

  private getRoutes(role: string, isAuthenticated: boolean): NavRoute[] {
    const commonRoutes: NavRoute[] = [
      {
        displayName: 'HOME',
        routerLink: '/',
        icon: faHome,
        isAdminRoute: false,
      },
      {
        displayName: 'CALENDAR',
        routerLink: '/secure/calendar',
        icon: faCalendar,
        isAdminRoute: false,
      },
      {
        displayName: 'DIVISIONS',
        routerLink: '/secure/divisions',
        icon: faBook,
        isAdminRoute: false,
        subroutes: this.divisions.map((division) => ({
          icon: null,
          displayName: division.name?.toUpperCase() ?? 'UNNAMED',
          routerLink: `/secure/divisions/${division.id}`,
          isAdminRoute: false,
        })),
      },
      {
        displayName: 'RULES',
        routerLink: '/secure/rules',
        icon: faBook,
        isAdminRoute: false,
        subroutes: this.rules.map((rule) => ({
          icon: null,
          displayName: rule.name?.toUpperCase() ?? 'UNNAMED',
          routerLink: `/secure/rules/${rule.division_id}`,
          isAdminRoute: false,
        })),
      },
      ...(this.isMember && role !== 'admin'
        ? []
        : [
            {
              displayName: 'MEMBERSHIP',
              routerLink: '/secure/membership',
              icon: faUser,
              isAdminRoute: false,
            },
          ]),
      {
        displayName: 'MAGAZINE',
        routerLink: '/secure/magazine',
        icon: faBook,
        isAdminRoute: false,
      },
      {
        displayName: 'CONTACT',
        routerLink: '/secure/contact',
        icon: faEnvelope,
        isAdminRoute: false,
      },
      {
        displayName: 'PROFILE',
        routerLink: '/secure/profile',
        icon: faUser,
        isAdminRoute: false,
      },
    ];

    // Add routes specifically for chairmen
    const chairmanRoutes: NavRoute[] = [
      {
        displayName: 'Edit Division Homepage',
        routerLink: `/secure/admin/cms/${this.chairmanDivisionId}`,
        icon: faChartBar,
        isAdminRoute: false,
      },
      {
        displayName: 'Edit Division Rules',
        routerLink: `/secure/admin/rules-cms/${this.chairmanRulesId}`,
        icon: faBook,
        isAdminRoute: false,
      },
      {
        displayName: 'Edit Division Calendar',
        routerLink: '/secure/admin/calendar',
        icon: faCalendar,
        isAdminRoute: false,
      },
    ];

    const adminRoutes: NavRoute[] = [
      {
        displayName: 'DIVISIONS',
        routerLink: '/secure/admin/divisions',
        icon: faRankingStar,
        isAdminRoute: true,
      },
      {
        displayName: 'RULES',
        routerLink: '/secure/admin/rules',
        icon: faBook,
        isAdminRoute: true,
      },
      {
        displayName: 'USERS',
        routerLink: '/secure/admin/users',
        icon: faUsers,
        isAdminRoute: true,
      },
      {
        displayName: 'CALENDAR',
        routerLink: '/secure/admin/calendar',
        icon: faCalendar,
        isAdminRoute: true,
      },
      {
        displayName: 'EMAILS',
        routerLink: '/secure/admin/emails',
        icon: faEnvelope,
        isAdminRoute: true,
      },
      {
        displayName: 'REPORTS',
        routerLink: '/secure/admin/reports',
        icon: faChartBar,
        isAdminRoute: true,
      },
      {
        displayName: 'CONTACTS',
        routerLink: '/secure/admin/contact-management',
        icon: faAddressBook,
        isAdminRoute: true,
      },
      {
        displayName: 'PROFILE',
        routerLink: '/secure/profile',
        icon: faUser,
        isAdminRoute: true,
      },
    ];

    // Return routes based on role
    if (isAuthenticated && role === 'admin') {
      return [...commonRoutes, ...adminRoutes];
    } else if (isAuthenticated && role === 'chairman') {
      this.chairmanRoutes = [...chairmanRoutes];
      return [...commonRoutes]; // Include chairman routes if applicable
    } else {
      return commonRoutes;
    }
  }
}

interface NavRoute {
  displayName: string;
  routerLink: string;
  icon: any;
  isAdminRoute: boolean;
  subroutes?: NavRoute[];
}

interface Division {
  id: number;
  name: string | null;
}

interface Rule {
  id: number;
  name: string | null;
  division_id: number | null;
  content: string;
}
