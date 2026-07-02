# District 14 Angular Client

# Installation

```
npm install
ng serve
```

This is an Angular Supabase application for District 14.

You can use an instance of Supabase with the Supabase service like so

```
export class MyComponent implements OnInit {
    users: User[] = [];
    constructor(private supabaseService: SupabaseService){}

    async fetchProfiles(){
        const {data, error} = await this.supabaseService.supabase.from("users").select("*");
        this.users = data;
    }
}


```