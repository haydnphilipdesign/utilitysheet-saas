import {
  Check,
  ChevronDown,
  Copy,
  Droplets,
  FileText,
  Flame,
  Globe,
  House,
  KeyRound,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  MessageSquare,
  Paperclip,
  Search,
  ShieldCheck,
  Sprout,
  UserPlus,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";

import "./product-mockups.css";

// Static, synthetic product illustrations for the public marketing pages.
// They are decorative (aria-hidden) and never wired to real data or controls;
// the surrounding copy carries the meaning for assistive technology.

const PROPERTY = "123 Maple Ave";

function Toggle({ on = true }: { on?: boolean }) {
  return <span className={`mock-toggle${on ? "" : " is-off"}`} />;
}

export function MockSellerLink() {
  return (
    <div className="mock-panel" aria-hidden="true">
      <p className="mock-title">Your seller link</p>
      <div className="mock-link-row">
        <span className="mock-input">
          <Link2 size={14} />
          utilitysheet.com/i/your-team
        </span>
        <span className="mock-button">
          <Copy size={13} /> Copy
        </span>
      </div>
      <p className="mock-status">
        <span className="mock-dot" /> Ready for your next property
      </p>
      <div className="mock-chips">
        <span><Mail size={13} /> Email</span>
        <span><MessageSquare size={13} /> Text</span>
        <span><ListChecks size={13} /> Checklist</span>
      </div>
    </div>
  );
}

export function MockGuidedForm() {
  return (
    <div className="mock-phone" aria-hidden="true">
      <div className="mock-phone-top">
        <span><MapPin size={12} /> {PROPERTY}</span>
        <span>Step 3 of 5</span>
      </div>
      <div className="mock-progress"><i style={{ width: "60%" }} /></div>
      <p className="mock-question">Is the home part of an HOA or condo association?</p>
      <div className="mock-options">
        <span>Yes</span>
        <span className="is-selected"><Check size={13} /> No</span>
        <span>Not sure</span>
      </div>
      <span className="mock-button mock-button-wide">Continue</span>
    </div>
  );
}

const suggestions = [
  { icon: Zap, utility: "Electricity", provider: "Maple Electric", confirmed: true },
  { icon: Droplets, utility: "Water & sewer", provider: "Springfield Water", confirmed: true },
  { icon: Flame, utility: "Natural gas", provider: "Springfield Gas", confirmed: false },
];

export function MockSuggestions() {
  return (
    <div className="mock-panel" aria-hidden="true">
      <p className="mock-title">Suggested for {PROPERTY}</p>
      <ul className="mock-list">
        {suggestions.map(({ icon: Icon, utility, provider, confirmed }) => (
          <li key={utility}>
            <span className="mock-icon"><Icon size={14} /></span>
            <span className="mock-stack">
              <b>{provider}</b>
              <small>{utility}</small>
            </span>
            {confirmed ? (
              <span className="mock-confirmed"><Check size={13} /> Confirmed</span>
            ) : (
              <span className="mock-button mock-button-small">Confirm</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mock-footnote"><Search size={13} /> Search for a different provider</p>
    </div>
  );
}

export function MockFormSettings() {
  return (
    <div className="mock-panel" aria-hidden="true">
      <div className="mock-select">
        <span className="mock-stack">
          <small>Saved seller form</small>
          <b>Listing intake</b>
        </span>
        <ChevronDown size={15} />
      </div>
      <ul className="mock-settings">
        <li>Electricity <Toggle /></li>
        <li>Internet <Toggle /></li>
        <li>HOA or condo association <Toggle /></li>
        <li>Electric meter number <Toggle on={false} /></li>
      </ul>
    </div>
  );
}

const sheetRows = [
  ["Electricity", "Maple Electric", "555-0101"],
  ["Water & sewer", "Springfield Water", "555-0103"],
  ["Natural gas", "Springfield Gas", "555-0102"],
  ["Internet", "Maple Fiber", "555-0104"],
];

export function MockSheet({
  brand,
  rows = 4,
  formats = true,
}: {
  brand?: { name: string; initials: string };
  rows?: number;
  formats?: boolean;
}) {
  return (
    <div className={`mock-sheet${brand ? " is-branded" : ""}`} aria-hidden="true">
      <div className="mock-sheet-head">
        <span className="mock-sheet-logo">{brand ? brand.initials : <House size={14} />}</span>
        <span className="mock-stack">
          <b>{brand ? brand.name : "Utility Info Sheet"}</b>
          <small><MapPin size={11} /> {PROPERTY}</small>
        </span>
      </div>
      <div className="mock-sheet-table">
        <span>Utility</span><span>Provider</span><span>Phone</span>
        {sheetRows.slice(0, rows).map(([utility, provider, phone]) => (
          <div key={utility}>
            <span>{utility}</span><span>{provider}</span><span>{phone}</span>
          </div>
        ))}
      </div>
      {formats && (
        <div className="mock-formats">
          <span><Globe size={12} /> Web sheet</span>
          <span><FileText size={12} /> PDF</span>
        </div>
      )}
    </div>
  );
}

export function MockCompletionEmail() {
  return (
    <div className="mock-panel mock-email" aria-hidden="true">
      <div className="mock-email-head">
        <span className="mock-icon"><Mail size={14} /></span>
        <span className="mock-stack">
          <b>Seller submitted: {PROPERTY}</b>
          <small>The utility sheet is ready to review.</small>
        </span>
      </div>
      <span className="mock-attachment">
        <Paperclip size={13} /> utility-sheet.pdf
      </span>
      <span className="mock-button mock-button-wide">Review in dashboard</span>
    </div>
  );
}

export function MockBranding() {
  return (
    <div className="mock-branding" aria-hidden="true">
      <div className="mock-panel">
        <p className="mock-title">Branding Profile</p>
        <div className="mock-brand-row">
          <span className="mock-logo-drop">MR</span>
          <span className="mock-stack">
            <b>Maple Realty Group</b>
            <small>Logo, colors &amp; contact details</small>
          </span>
        </div>
        <div className="mock-swatches">
          <i style={{ background: "#2f5d50" }} className="is-selected" />
          <i style={{ background: "#123e56" }} />
          <i style={{ background: "#8a4b2a" }} />
          <i style={{ background: "#5b4a8b" }} />
        </div>
        <ul className="mock-settings">
          <li>Branded seller link <Toggle /></li>
          <li>Remove UtilitySheet footer <Toggle /></li>
        </ul>
      </div>
      <MockSheet brand={{ name: "Maple Realty Group", initials: "MR" }} rows={3} formats={false} />
    </div>
  );
}

export function MockEditSheet() {
  return (
    <div className="mock-panel" aria-hidden="true">
      <p className="mock-title">Edit submitted sheet</p>
      <label className="mock-field">
        <small>Electricity provider</small>
        <span className="mock-input is-focused">Maple Electric</span>
        <s>maple electric co</s>
      </label>
      <label className="mock-field">
        <small>Internet provider</small>
        <span className="mock-input">Maple Fiber</span>
      </label>
      <p className="mock-saved">
        <Check size={14} /> Saved. New PDF downloads use this version.
      </p>
    </div>
  );
}

const packetSections = [
  { icon: Zap, label: "Utilities", on: true },
  { icon: Wrench, label: "Home systems", on: true },
  { icon: KeyRound, label: "Access & mailbox", on: true },
  { icon: Sprout, label: "Lawn, snow & irrigation", on: true },
  { icon: ShieldCheck, label: "Security & smart devices", on: false },
  { icon: Wifi, label: "Home service contacts", on: true },
];

export function MockPacketSections() {
  return (
    <div className="mock-panel" aria-hidden="true">
      <p className="mock-title">Property Handoff Packet</p>
      <ul className="mock-settings mock-settings-icons">
        {packetSections.map(({ icon: Icon, label, on }) => (
          <li key={label}>
            <span><Icon size={14} /> {label}</span>
            <Toggle on={on} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const members = [
  { initials: "JR", name: "Jordan Reyes", role: "Admin" },
  { initials: "SP", name: "Sam Patel", role: "Member" },
  { initials: "AK", name: "Alex Kim", role: "Member" },
];

export function MockTeam() {
  return (
    <div className="mock-panel" aria-hidden="true">
      <p className="mock-title">Team workspace</p>
      <div className="mock-link-row">
        <span className="mock-input">teammate@yourteam.com</span>
        <span className="mock-button">
          <UserPlus size={13} /> Invite
        </span>
      </div>
      <ul className="mock-list mock-members">
        {members.map(({ initials, name, role }) => (
          <li key={name}>
            <span className="mock-avatar">{initials}</span>
            <b>{name}</b>
            <span className="mock-role">{role}</span>
          </li>
        ))}
      </ul>
      <p className="mock-footnote">
        <Check size={13} /> Shared requests &amp; Branding Profiles
      </p>
    </div>
  );
}
