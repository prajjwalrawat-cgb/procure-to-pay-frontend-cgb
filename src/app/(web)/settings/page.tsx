'use client';

import { PERMISSIONS, type Permission } from '@/lib/shared';
import {
  Building2,
  Landmark,
  ListPlus,
  MapPin,
  Image as ImageIcon,
  Tags,
} from 'lucide-react';
import { useState } from 'react';

import { useHasPermission } from '@/lib/permissions';
import { BankAccountsSection } from './bank-accounts-section';
import { BrandingSection } from './branding-section';
import { BranchesSection } from './branches-section';
import { CustomFieldsSection } from './custom-fields-section';
import { OrganisationSection } from './organisation-section';
import { VendorCategoriesSection } from './vendor-categories-section';

/**
 * Organisation settings. Everything that names the buying organisation — the
 * PO letterhead, the jurisdiction clause, the place of supply behind the
 * CGST/SGST-vs-IGST split, and the app's own page subheadings — is maintained
 * here, so nothing about a tenant is fixed in code.
 *
 * Sections are permissioned individually rather than the page as a whole:
 * finance owns the disbursement accounts and reaches them here without holding
 * admin rights over the organisation's identity.
 */
const SECTIONS = [
  {
    key: 'organisation',
    group: 'Workspace',
    label: 'Organisation',
    icon: Building2,
    permission: PERMISSIONS.SETTINGS_READ,
  },
  {
    key: 'branches',
    group: 'Workspace',
    label: 'GST registrations',
    icon: MapPin,
    permission: PERMISSIONS.SETTINGS_READ,
  },
  {
    key: 'branding',
    group: 'Workspace',
    label: 'Branding',
    icon: ImageIcon,
    permission: PERMISSIONS.SETTINGS_READ,
  },
  {
    key: 'bank-accounts',
    group: 'Finance',
    label: 'Bank accounts',
    icon: Landmark,
    permission: PERMISSIONS.BANK_ACCOUNT_READ,
  },
  {
    key: 'vendor-categories',
    group: 'Vendors',
    label: 'Vendor categories',
    icon: Tags,
    permission: PERMISSIONS.SETTINGS_READ,
  },
  {
    key: 'custom-fields',
    group: 'Documents',
    label: 'Custom fields',
    icon: ListPlus,
    permission: PERMISSIONS.SETTINGS_READ,
  },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

export default function SettingsPage(): React.JSX.Element {
  // Two fixed checks rather than one per section, so the hook count is stable.
  const canSettings = useHasPermission(PERMISSIONS.SETTINGS_READ as Permission);
  const canBanks = useHasPermission(PERMISSIONS.BANK_ACCOUNT_READ as Permission);
  const allowed = (p: Permission): boolean =>
    p === PERMISSIONS.BANK_ACCOUNT_READ ? canBanks : canSettings;

  const visible = SECTIONS.filter((s) => allowed(s.permission as Permission));
  const [active, setActive] = useState<SectionKey | null>(null);
  const current = active ?? visible[0]?.key ?? null;
  const groups = [...new Set(visible.map((s) => s.group))];

  if (visible.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[20px] font-semibold tracking-heading text-ink">Settings</h1>
        <p className="mt-2 text-[13px] text-muted">
          You do not have access to any settings. Ask an administrator if you need it.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <h1 className="text-[20px] font-semibold tracking-heading text-ink">Settings</h1>
      <p className="mb-5 text-[13px] text-muted">
        Manage organisation identity, GST registrations, branding, banking, vendor
        categories and document fields.
      </p>

      <div className="grid gap-6 border-t border-line pt-5 md:grid-cols-[220px_1fr]">
        <nav className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wide text-faint">
                {group}
              </div>
              {visible
                .filter((s) => s.group === group)
                .map((s) => {
                  const Icon = s.icon;
                  const on = current === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setActive(s.key)}
                      className={
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors ' +
                        (on
                          ? 'bg-accent-wash font-medium text-accent-2'
                          : 'text-muted hover:bg-canvas hover:text-text')
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {s.label}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        <div>
          {current === 'organisation' && <OrganisationSection />}
          {current === 'branches' && <BranchesSection />}
          {current === 'branding' && <BrandingSection />}
          {current === 'bank-accounts' && <BankAccountsSection />}
          {current === 'vendor-categories' && <VendorCategoriesSection />}
          {current === 'custom-fields' && <CustomFieldsSection />}
        </div>
      </div>
    </div>
  );
}
