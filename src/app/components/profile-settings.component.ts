import { Component, computed, inject, signal } from '@angular/core';
import { BudgetStore } from '../budget-store.service';
import { PERCENTAGE_PROFILES, PercentageProfile } from '../models';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  templateUrl: './profile-settings.component.html',
})
export class ProfileSettingsComponent {
  readonly store = inject(BudgetStore);
  readonly profiles = PERCENTAGE_PROFILES;
  readonly pending = signal<PercentageProfile | null>(null);
  readonly pendingTotal = computed(() => {
    const profile = this.pending();
    return profile ? this.store.profileTotal(profile.id) : 0;
  });

  confirm(): void {
    const profile = this.pending();
    if (profile) {
      this.store.applyPercentageProfile(profile.id);
    }
    this.pending.set(null);
  }
}
