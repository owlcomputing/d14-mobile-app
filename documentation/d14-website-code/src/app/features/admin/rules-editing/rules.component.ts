import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './rules.component.html',
})
export class RulesComponent implements OnInit {
  rules: any[] = [];
  newRuleName: string = '';

  constructor(private supabase: SupabaseService) {}

  async ngOnInit() {
    await this.fetchRules();
  }

  async fetchRules() {
    const { data, error } = await this.supabase.supabase
      .from('rules')
      .select('*');
    if (error) {
      throw new Error('Could not fetch rules');
    }
    this.rules = data;
  }

  async addRule() {
    if (!this.newRuleName) {
      return;
    }
    const { data, error } = await this.supabase.supabase
      .from('rules')
      .insert([{ name: this.newRuleName, content: '' }])
      .select();
    if (error) {
      console.error('Error adding rule', error);
      return;
    }

    const newRule = data[0];
    this.rules.push(newRule);
    this.newRuleName = '';
  }

  async deleteRule(id: number) {
    try {
      // Delete the rule
      const { error: ruleError } = await this.supabase.supabase
        .from('rules')
        .delete()
        .eq('id', id);
      if (ruleError) {
        console.error('Error deleting rule', ruleError);
        return;
      }

      // Remove the deleted rule from the local array
      this.rules = this.rules.filter((rule) => rule.id !== id);
    } catch (error) {
      console.error('Error deleting rule', error);
    }
  }

  trackById(index: number, rule: any): number {
    return rule.id;
  }
}
