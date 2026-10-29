import Link from "next/link";
import { ArrowUpRight, ArrowRight, ShieldCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
export function Badge({
  children,
  tone = "amber",
}: {
  children: ReactNode;
  tone?: "amber" | "green" | "navy" | "neutral";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p className="lede">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function ButtonLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={`button ${secondary ? "secondary" : ""}`} href={href}>
      {children}
      <ArrowUpRight size={17} aria-hidden="true" />
    </Link>
  );
}
export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <Info size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
export function Source({
  href,
  children = "Первоисточник",
}: {
  href: string;
  children?: ReactNode;
}) {
  return (
    <a className="source" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <ShieldCheck size={30} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{children}</p>
      <Link href="/explore" className="text-link">
        К списку компаний <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}
export function SectionTitle({
  title,
  aside,
}: {
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {aside}
    </div>
  );
}
