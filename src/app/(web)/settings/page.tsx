'use client';

import { Building2, ListPlus, MapPin, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';

import { BrandingSection } from './branding-section';
import { BranchesSection } from './branches-section';
import { CustomFieldsSection } from './custom-fields-section';
import { OrganisationSection } from './organisation-section';

/**
 * Organisation settings. Everything that names the buying organisation — the
 * PO letterhead, the jurisdiction clause, the place of supply behind the
 * CGST/SGST-vs-IGST split, and the app's own page subheadings — is maintained
 * here, so nothing about a tenant is fixed in code.
 */
const SECTIONS = [
  {
    key: 'organisation',
    group: 'Workspace',
    label: 'Organisation',
    icon: Building2,
    hint: 'Legal name, GSTIN and currency',
  },
  {
    key: 'branches',
    group: 'Workspace',
    label: 'GST registrations',
    icon: MapPin,
    hint: 'One branch per state registration',
  },
  {
    key: 'branding',
    group: 'Workspace',
    label: 'Branding',
    icon: ImageIcon,
    hint: 'Letterhead logo printed on PDFs',
  },
  {
    key: 'custom-fields',
    group: 'Documents',
    label: 'Custom fields',
    icon: ListPlus,
    hint: 'Add your own fields to any form',
  },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

export default function SettingsPage(): React.JSX.Element {
  const [active, setActive] = useState<SectionKey>('organisation');
  const groups = [...new Set(SECTIONS.map((s) => s.group))];

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <h1 className="text-[20px] font-semibold tracking-heading text-ink">Settings</h1>
      <p className="mb-5 text-[13px] text-muted">
        Manage organisation identity, GST registrations, branding and document fields.
      </p>

      <div className="grid gap-6 border-t border-line pt-5 md:grid-cols-[220px_1fr]">
        <nav className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wide text-faint">
                {group}
              </div>
              {SECTIONS.filter((s) => s.group === group).map((s) => {
                const Icon = s.icon;
                const on = active === s.key;
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
          {active === 'organisation' && <OrganisationSection />}
          {active === 'branches' && <BranchesSection />}
          {active === 'branding' && <BrandingSection />}
          {active === 'custom-fields' && <CustomFieldsSection />}
        </div>
      </div>
    </div>
  );
}
